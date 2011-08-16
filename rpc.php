<?php

require "config.php";

/** Remove non-secure etc. chars from path element */
function getclean($path)
{
	/* remove */
	$stage1 = str_replace(array(".."), "", $path);

	/* replace */
	$stage2 = str_replace(array("/"), "_", $stage1);

	return $stage2;
}

function rmfr($path)
{
	if (is_dir($path)) {
		foreach (scandir($path) as $name) {
			if ($name == "." || $name == "..")
				continue;

			if (is_dir("$path/$name"))
				rmfr("$path/$name");
			else
				unlink("$path/$name");
		}

		return rmdir($path);
	} else {
		return unlink($path);
	}
}

function cpa($path, $dest)
{
	if (is_dir($path)) {
		/* make destination dir */
		$stat = stat($path);
		if (!mkdir($dest, $stat["mode"], true))
			return false;

		/* copy contents inside it */
		foreach (scandir($path) as $name) {
			if ($name == "." || $name == "..")
				continue;

			if (is_dir("$path/$name")) {
				cpa("$path/$name", "$dest/$name");
			} else {
				if (copy("$path/$name", "$dest/$name")) {
					$stat = stat("$path/$name");
					chmod("$dest/$name", $stat["mode"]);
				} else {
					return false;
				}
			}
		}
	} else {
		if (copy($path, $dest)) {
			$stat = stat($path);
			chmod($dest, $stat["mode"]);
		} else {
			return false;
		}
	}

	return true;
}

/*** RPC functions ***/
/** List taskdefs
 * @return       array of taskdef names
 */
function rpc_list($p)
{
	$out = array();

	foreach (scandir(CFG_TASKDIR) as $name) {
		if ($name[0] != '.')
			$out[] = $name;
	}

	return res($out);
}

/** Rename taskdef
 * @param name         taskdef name
 * @param new          new name
 * @return             object with
 *   bool status       true if success
 */
function rpc_rename($p)
{
	$name = getclean($p["name"]);
	$new = getclean($p["new"]);

	if (!$name || !$new)
		return err(2, "either 'name' or 'new' not provided");

	return res(array(
		"status" => rename(CFG_TASKDIR . "/$name", CFG_TASKDIR . "/$new")
	));
}

/** Recursively deletes taskdef
 * @param name        name
 * @return            object:
 *   bool status      true if success
 */
function rpc_delete($p)
{
	$name = getclean($p["name"]);
	if (!$name)
		return err(3, "param 'name' not provided");

	return res(array(
		"status" => rmfr(CFG_TASKDIR . "/$name")
	));
}

/** Create new taskdef
 * @param name         name (optional)
 * @param tpl          existing taskdef to use as template (optional)
 * @return             object:
 *   bool status       true if success
 *   string name       name of created taskdef
 */
function rpc_create($p)
{
	$name = getclean($p["name"]);
	while ($name[0] == '.')
		$name = substr($name, 1);

	$tpl = getclean($p["tpl"]);
	if (!$name) {
		if ($tpl)
			$name = "$tpl-copy";
		else
			$name = "taskdef";
	}

	/* find unique name */
	$i = 1;
	$path = sprintf("%s/%s", CFG_TASKDIR, $name);
	while (file_exists($path)) {
		$path = sprintf("%s/%s-%d", CFG_TASKDIR, $name, ++$i);
	}

	if ($i > 1)
		$name = sprintf("%s-%d", $name, $i);

	if (!$tpl)
		$tpl = ".tpl";

	return res(array(
		"status" => cpa(CFG_TASKDIR . "/$tpl", CFG_TASKDIR . "/$name"),
		"name"   => $name
	));
}

/** Fetch taskdef contents
 * @param   name      taskdef name
 * @return object with taskdef filenames as keys + contents as values
 */
function rpc_fetch($p)
{
	$name = getclean($p["name"]);
	if (!$name)
		return err(4, "param 'name' not provided");

	foreach (scandir(CFG_TASKDIR . "/$name") as $file) {
		if ($file[0] == '.')
			continue;

		$out[$file] = file_get_contents(CFG_TASKDIR . "/$name/$file");
	}

	return res($out);
}

/** Store taskdef contents
 * @param name      taskdef name
 * @param taskdef   task definitions - see object returned by rpc_fetch()
 * @return            object:
 *   bool status      true if success
 */
function rpc_store($p)
{
	$name = getclean($p["name"]);
	if (!$name)
		return err(5, "param 'name' not provided");

	$taskdef = $p["taskdef"];
	if (!$taskdef || !is_array($taskdef))
		return err(6, "invalid or non-existent 'taskdef' param");

	$err = false;
	foreach ($taskdef as $file => $contents) {
		$rc = file_put_contents(CFG_TASKDIR . "/$name/$file", $contents);

		if ($rc == FALSE) {
			$err = true;
			break;
		}
	}

	return res(array(
		"status" => !$err
	));
}

/** Run given taskdef
 * @param name       taskdef name
 * @param reboot     run by doing a full reboot
 * @return            object:
 *   bool status      true if success
 */
function rpc_run($p)
{
	$name = getclean($p["name"]);
	if (!$name)
		return err(5, "param 'name' not provided");

	if ($p["reboot"])
		$tool = "rb-reset-all";
	else
		$tool = "rb-rerun-all";

	unlink(CFG_TASKDIR . "/.cur");
	symlink($name, CFG_TASKDIR . "/.cur");

	$rc = -1;
	$out = array();
	exec(CFG_RBTOOLS . "/$tool", $out, $rc);

	return res(array(
		"status" => ($rc == 0)
	));
}

/*********************/

function err($code, $msg)
{
	return array("error" => array(
		"code"      => $code,
		"message"   => $msg
	));
}

function res($result)
{
	return array("result" => $result);
}

/*********************/

if ($_SERVER['REQUEST_METHOD'] == 'POST') {
	$req = json_decode($HTTP_RAW_POST_DATA, true);
	if ($req !== NULL) {
		$method = $req["method"];
		$params = $req["params"];
	} else {
		$method = $_POST["method"];
		$params = $_POST["params"];
	}
} else {
	$method = $_GET["q"];
	$params = $_GET;
}

$handler = "rpc_$method";

if (function_exists($handler)) {
	$out = $handler($params);
} else if (isset($examples) && array_key_exists($method, $examples)) {
	$out = res($examples[$method]);
} else {
	$out = err(1, "Invalid method");
}

header("Content-Type: application/json-rpc");
echo json_encode($out) . "\n";
