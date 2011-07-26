/*
 * iitis-taskcreator
 * Paweł Foremski <pjf@iitis.pl> 2011
 * IITiS PAN Gliwice
 */

var C = {
init: function()
{
	$("#bpane").tabs();

	/* buttons */
	C.taskdef_init();
	C.editor_init();
	C.buttons_init();
},

/**********/

taskdef_current: "",
taskdef_current_istpl: false,

taskdef_init: function()
{
	$("#taskdef").change(C.taskdef_changed);
	C.taskdef_reload();
},

taskdef_select: function(name)
{
	$("#taskdef option:selected").attr("selected", false);
	$("#taskdef option").each(function(i, e)
	{
		if ($(e).data("name") == name) {
			$(e).attr("selected", true);
			return true;
		}
	});

	return false;
},

taskdef_changed: function(e)
{
	/* prevent loosing unsaved taskdef */
	if ($("#td-modified:visible").length > 0) {
		if (!confirm("Current task definition not saved. Continue?")) {
			C.taskdef_select(C.taskdef_current);
			return;
		} else {
			$("#td-modified").hide();
		}
	}

	/* disable rename and delete on tpl */
	C.taskdef_current_istpl = $("#taskdef option:selected").data("istpl");
	C.buttons_tpl_toggle();

	C.taskdef_current = $("#taskdef option:selected").data("name");
	C.editor_load();
},

taskdef_reload: function(target)
{
	var cur = target ? target : C.taskdef_current;
	var changed = true;

	$("#taskdef").empty();
	C.taskdef_current = "";

	$.rpc("list", {}, function(d)
	{
		$.each(d, function(k, v)
		{
			var o = $("<option>");

			o.data({name: v})
			o.text(v);

			if (cur == v) {
				o.attr("selected", true);
				C.taskdef_current = v;
				changed = false;
			} else if (!C.taskdef_current) {
				C.taskdef_current = v;
			}

			o.appendTo("#taskdef");
		});

		/* add "template" taskdef */
		var o = $("<option>");
		o.data({name: ".tpl", istpl: true });
		o.text("* Task definition template *");
		o.appendTo("#taskdef");

		if (changed)
			C.taskdef_changed();
	});
},

/**********/

editor_init: function()
{
	$("#td-modified").hide();
	$("#bpane textarea.taskdef").keydown(C.editor_writing);
},

editor_load: function()
{
	$.rpc("fetch", { name: C.taskdef_current }, function(d)
	{
		$.each(d, function(k, v)
		{
			$("#bpane textarea.taskdef#" + k).val(v);
		});
	});
},

editor_writing: function()
{
	$("#td-modified").fadeIn(1000);
},

/**********/

buttons_init: function()
{
	$("#td-duplicate").button({icons: { primary: "ui-icon-copy" }});
	$("#td-duplicate").click(C.buttons_dup);

	$("#td-rename").button({icons: { primary: "ui-icon-pencil" }});
	$("#td-rename").click(C.buttons_rename);

	$("#td-delete").button({icons: { primary: "ui-icon-trash" }});
	$("#td-delete").click(C.buttons_delete);

	$("#td-new").button({icons: { primary: "ui-icon-document" }});
	$("#td-new").click(C.buttons_new);

	$("#td-run").button({icons: { primary: "ui-icon-gear" }});
	$("#td-run").click(C.buttons_run);

	$("#td-save").button({icons: { primary: "ui-icon-disk" }});
	$("#td-save").click(C.buttons_save);
},

buttons_tpl_toggle: function()
{
	if (C.taskdef_current_istpl) {
		$("#td-rename").button("option", "disabled", true);
		$("#td-delete").button("option", "disabled", true);
		$("#td-run").button("option", "disabled", true);
	} else {
		$("#td-rename").button("option", "disabled", false);
		$("#td-delete").button("option", "disabled", false);
		$("#td-run").button("option", "disabled", false);
	}
},

buttons_save: function()
{
	var td = {};
	var name = C.taskdef_current;

	if (!name)
		return;

	$("#bpane textarea.taskdef").each(function(i, e)
	{
		td[$(e).attr("id")] = $(e).val();
	});

	$.rpc("store", { name: name, taskdef: td }, function(d)
	{
		if (d.status) {
			$("#td-modified").fadeOut(1000);
		} else {
			alert("Save failed");
		}
	});
},

buttons_dup: function()
{
	var tpl = C.taskdef_current;
	var name;

	if (!tpl)
		return;

	name = prompt("Name for new task definition", tpl);
	if (!name)
		return;

	$.rpc("create", { name: name, tpl: tpl }, function(d)
	{
		if (d.status) {
			C.taskdef_reload();
			alert(
				"Task definition '" + d.name + "' created.\n" +
				"Navigate the task definition list in order to edit it.");
		} else {
			alert("Action failed");
		}
	});
},

buttons_new: function()
{
	var name;

	name = prompt("Name for new task definition", "taskdef");
	if (!name)
		return;

	$.rpc("create", { name: name }, function(d)
	{
		if (d.status) {
			C.taskdef_reload();
			alert(
				"Task definition '" + d.name + "' created.\n" +
				"Navigate the task definition list in order to edit it.");
		} else {
			alert("Action failed");
		}
	});
},

buttons_rename: function()
{
	var name = C.taskdef_current;
	var name2;

	if (C.taskdef_current_istpl)
		return;

	if (!name)
		return;

	name2 = prompt("New name", name);
	if (!name2)
		return;

	$.rpc("rename", { name: name, "new": name2 }, function(d)
	{
		if (d.status) {
			C.taskdef_reload(name2);
		} else {
			alert("Action failed");
		}
	});
},

buttons_delete: function()
{
	var name = C.taskdef_current;

	if (C.taskdef_current_istpl)
		return;

	if (!name)
		return;

	if (!confirm("Delete task definition '" + name + "'?"))
		return;

	$.rpc("delete", { name: name }, function(d)
	{
		if (d.status) {
			C.taskdef_reload();
		} else {
			alert("Deletion failed");
		}
	});
},

buttons_run: function()
{
	var name = C.taskdef_current;

	if (C.taskdef_current_istpl)
		return;

	if (!name)
		return;

	if ($("#td-modified:visible").length > 0) {
		if (!confirm("Task definition not saved. Continue?")) {
			return;
		}
	}

	if (!confirm(
		"Requested running task definition '" + name + "'.\nThis will abort any ongoing tasks.\n\n" +
		"Are you sure?"))
		return;

	$.rpc("run", { name: name, reboot: $("#td-reboot").prop("checked") }, function(d)
	{
		if (d.status) {
			alert("Task started");
		} else {
			alert("Starting failed");
		}
	});
}

};
