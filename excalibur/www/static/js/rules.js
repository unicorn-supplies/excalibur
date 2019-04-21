// https://coderwall.com/p/flonoa/simple-string-format-in-javascript
String.prototype.format = function () {
  var str = this;
  for (var i in arguments) {
    str = str.replace(new RegExp('\\{' + i + '\\}', 'gm'), arguments[i]);
  }
  return str;
};

const onRuleDownload = (e) => {
  // https://stackoverflow.com/a/30800715/2780127
  const ruleName = e.nextElementSibling.getAttribute('data-rule-name');
  const ruleOptions = e.nextElementSibling.getAttribute('data-rule-options');
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(ruleOptions);
  e.nextElementSibling.setAttribute("href", dataStr);
  e.nextElementSibling.setAttribute("download", "{0}.json".format(ruleName));
  e.nextElementSibling.click();
};

const onRuleDelete = (e) => {
  const ruleId = e.getAttribute('data-rule-id');
  const ruleName = $(".rule-name[data-rule-id={0}]".format(ruleId)).val();

  const message = "Delete rule '{0}' ({1}).\nThis cannot be undone!\nAre you sure?".format(ruleName, ruleId);

  if (confirm(message)) {
    $.ajax({
      url: "/ui/rules/{0}".format(ruleId),
      type: "DELETE",
      cache: false,
      contentType: false,
      processData: false,
      success: function (data) {
        window.location.reload();
      }
    });
  }
};

const onRuleUpdate = (e) => {
  const ruleId = e.getAttribute('data-rule-id');
  const ruleName = $(".rule-name[data-rule-id={0}]".format(ruleId)).val();
  const ruleOptions = $(".rule-options[data-rule-id={0}]".format(ruleId)).val();

  var data = new FormData();
  data.append('rule_name', ruleName);
  data.append('rule_options', ruleOptions);

  $.ajax({
    url: "/ui/rules/{0}".format(ruleId),
    type: "PATCH",
    cache: false,
    contentType: false,
    processData: false,
    data: data,
    success: function (data) {
      console.log(data);
      window.location.reload();
    },
    error: function (data) {
      alert("{0}: {1}".format(
        data.statusText,
        data.responseJSON.error
      ));
    }
  });
};

$(document).ready(function () {
  $('#rule_upload').on('change', function () {
    var data = new FormData();
    // TODO: add support to upload multiple files
    $.each($('#rule_upload')[0].files, function (i, file) {
      data.append('file-' + i, file);
    });
    $.ajax({
      url: '/ui/rules',
      type: 'POST',
      cache: false,
      contentType: false,
      data: data,
      processData: false,
      success: function (data) {
        window.location.reload();
      }
    });
  });
});
