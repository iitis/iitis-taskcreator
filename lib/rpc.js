(function($){
/** Make a JSON-RPC call
 * @param method {String}   method name
 * @param params {Object}   parameters
 * @param cb {Function}     success callback (gets data.result and method)
 * @param errcb {Function}  error callback (gets data.error and method)
 * @param options {Object}  additional JQuery AJAX options (see docs) */
$.rpc = $.rpc || function(method, params, cb, errcb, options)
{
	return $.ajax($.extend({
		contentType: 'application/json',
		type: 'POST',
		url: "rpc.php",
		success: function(data) {
			if (cb && data.result)
				cb(data.result, method);
			else if (errcb && data.error)
				errcb(data.error, method);
		},
		data: JSON.stringify({ method: method, params: params })
	}, options));
}})(jQuery);
