// https://coderwall.com/p/flonoa/simple-string-format-in-javascript
String.prototype.format = function () {
  var str = this;
  for (var i in arguments) {
    str = str.replace(new RegExp('\\{' + i + '\\}', 'gm'), arguments[i]);
  }
  return str;
}

$(document).ready(function () {
  $('#file').on('change',function (){
    // get the file name
    const filename = document.getElementById("file").files[0].name;
    // replace the "Choose file..." label
    $(this).next('.uploadFile__label').html(filename);
  })

  const onUpload = function () {
    var data = new FormData();
    // TODO: add support to upload multiple files
    $.each($('#file')[0].files, function (i, file) {
      data.append('file-' + i, file);
    });
    var pages = $('#pages').val() ? $('#pages').val() : 1;
    data.append('pages', pages);
    var ocr_my_pdf = $('#ocr_my_pdf').val() ? parseInt($('#ocr_my_pdf').val()) : 0;
    data.append('ocr_my_pdf', ocr_my_pdf);
    $.ajax({
      url: '/files',
      type: 'POST',
      cache: false,
      contentType: false,
      data: data,
      processData: false,
      success: function (data) {
        var redirect = '{0}//{1}/workspaces/{2}'.format(window.location.protocol, window.location.host, data['file_id']);
        window.location.replace(redirect);
      }
    });
  };

  $("#upload").bind("click", function() {
    $("#upload").attr("disabled", true);
    $("#upload").unbind("click");
    onUpload();
  });
});
