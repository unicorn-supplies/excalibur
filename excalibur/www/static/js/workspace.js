let globalRuleId = '';

// https://coderwall.com/p/flonoa/simple-string-format-in-javascript
String.prototype.format = function () {
  let str = this;
  for (let i in arguments) {
    str = str.replace(new RegExp('\\{' + i + '\\}', 'gm'), arguments[i]);
  }
  return str;
}

const getTableAreasForRender = function (page, detectedAreas, columnSeparators) {
  const imageWidth = $('#image-{0}'.format(page)).width();
  const imageHeight = $('#image-{0}'.format(page)).height();
  if (imageWidth !== undefined && imageHeight !== undefined && fileDims[page] !== undefined) {
    const scalingFactorX = imageWidth / fileDims[page][0];
    const scalingFactorY = imageHeight / fileDims[page][1];

    let tableAreas = [];
    let x1, x2, y1, y2;
    for (let i = 0; i < detectedAreas.length; i++) {
      x1 = detectedAreas[i][0] * scalingFactorX;
      x2 = detectedAreas[i][2] * scalingFactorX;
      y1 = (detectedAreas[i][1]) * scalingFactorY;
      y2 = (detectedAreas[i][3]) * scalingFactorY;
      const tableArea = {
        id: i,
        x: Math.floor(x1),
        y: Math.floor(Math.abs(y1 - imageHeight)),
        z: 0,
        width: Math.floor(Math.abs(x2 - x1)),
        height: Math.floor(Math.abs(y2 - y1)),
        page: parseInt(page),
        columns: columnSeparators[i] || []
      };
      tableAreas.push(tableArea);
    }
    return tableAreas;
  }
};

const getTableAreasForJob = function (page, selectedAreas) {
  const imageWidth = $('#image-{0}'.format(page)).width();
  const imageHeight = $('#image-{0}'.format(page)).height();
  if (imageWidth !== undefined && imageHeight !== undefined && fileDims[page] !== undefined) {
    const scalingFactorX = fileDims[page][0] / imageWidth;
    const scalingFactorY = fileDims[page][1] / imageHeight;

    let tableAreas = [];
    let columns = [];
    let x1, x2, y1, y2;
    for (let i = 0; i < selectedAreas.length; i++) {
      x1 = selectedAreas[i].x * scalingFactorX;
      x2 = (selectedAreas[i].x + selectedAreas[i].width) * scalingFactorX;
      y1 = Math.abs(selectedAreas[i].y - imageHeight) * scalingFactorY;
      y2 = Math.abs(selectedAreas[i].y + selectedAreas[i].height - imageHeight) * scalingFactorY;
      tableAreas.push([x1, y1, x2, y2].join());
      if (selectedAreas[i].columns.length) {
        columns.push(selectedAreas[i].columns.join());
      } else {
        columns.push("");
      }
    }
    return [tableAreas, columns];
  }
};

const onSavedRuleClick = function (e) {
  const rule_id = e.getAttribute('data-rule-id');
  globalRuleId = rule_id;
  $.ajax({
    url: '/ui/rules/{0}'.format(rule_id),
    type: 'GET',
    success: function (data) {
      if (data['message'] == 'Rule not found') {
        console.log(data['message']);
      } else {
        const ruleOptions = data['rule_options'];
        onFlavorChange();
        document.getElementById('flavors').value = ruleOptions['flavor'];

        if (Object.keys(ruleOptions['pages']).length) {
          resetTableAreas();
          let tableAreas = [];
          let columnSeparators = [];

          for (let page in ruleOptions['pages']) {
            if ('table_areas' in ruleOptions['pages'][page]) {
              const table_areas = ruleOptions['pages'][page]['table_areas'] || [];
              table_areas.forEach(function (t) {
                let parts = t.split(',');
                if (parts.length >= 1 && parts[0] !== "") {
                  tableAreas.push(parts.map(Number));
                }
              });
            }

            if ('columns' in ruleOptions['pages'][page]) {
              const columns = ruleOptions['pages'][page]['columns'] || [];
              columns.forEach(function (c) {
                let parts = c.split(',');
                if (parts.length >= 1 && parts[0] !== "") {
                  columnSeparators.push(parts.map(Number));
                } else {
                  columnSeparators.push([]);
                }
              });
            }

            renderTableAreas(page, tableAreas, columnSeparators);
            tableAreas = [];
            columnSeparators = [];
          }
        }


        if (ruleOptions['flavor'].toLowerCase() == 'lattice') {
          document.getElementById('process-background').checked = !!ruleOptions['process_background'];
          document.getElementById('line-size-scaling').value = Number(ruleOptions['line_size_scaling']);
          document.getElementById('split-text-l').checked = !!ruleOptions['split_text'];
          document.getElementById('flag-size-l').checked = !!ruleOptions['flag_size'];
        } else if (ruleOptions['flavor'].toLowerCase() == 'stream') {
          document.getElementById('row-close-tol').value = Number(ruleOptions['row_close_tol']);
          document.getElementById('col-close-tol').value = Number(ruleOptions['col_close_tol']);
          document.getElementById('edge-close-tol').value = Number(ruleOptions['edge_close_tol']);
          document.getElementById('split-text-s').checked = !!ruleOptions['split_text'];
          document.getElementById('flag-size-s').checked = !!ruleOptions['flag_size'];
          document.getElementById('strip-text').value = ruleOptions['strip_text'];
        } else {
          console.log('Unknown flavor {0}'.format(ruleOptions['flavor']));
        }
      }
    },
    error: function (error) {
      console.log(error);
    }
  });
};

const getRuleOptions = function () {
  let ruleOptions = {'pages': {}};
  const flavor = $('#flavors').val();
  ruleOptions['flavor'] = flavor;

  if (flavor === null) {
    alert('Please select a Flavor from Advanced.')
  } else {
    // advanced settings
    switch(flavor.toString().toLowerCase()) {
      case 'lattice': {
        ruleOptions['process_background'] = $("#process-background")[0].checked;
        ruleOptions['line_size_scaling'] = $('#line-size-scaling').val() ? Number($('#line-size-scaling').val()) : 15;
        ruleOptions['split_text'] = $("#split-text-l")[0].checked;
        ruleOptions['flag_size'] = $("#flag-size-l")[0].checked;
        break;
      }
      case 'stream': {
        ruleOptions['row_close_tol'] = $('#row-close-tol').val() ? Number($('#row-close-tol').val()) : 2;
        ruleOptions['col_close_tol'] = $('#col-close-tol').val() ? Number($('#col-close-tol').val()) : 0;
        ruleOptions['edge_close_tol'] = $('#edge-close-tol').val() ? Number($('#edge-close-tol').val()) : 0;
        ruleOptions['split_text'] = $("#split-text-s")[0].checked;
        ruleOptions['flag_size'] = $("#flag-size-s")[0].checked;
        ruleOptions['strip_text'] = $("#strip-text").val();
        break;
      }
      default: {
        break;
      }
    }
  }

  // table areas and columns for each page
  for (let page in detectedAreas) {
    ruleOptions['pages'][page] = {};
    const selectedAreas = $('#image-{0}'.format(page)).selectAreas('areas');

    var areas_columns = [null, null];

    if (selectedAreas.length > 0) {
      areas_columns = getTableAreasForJob(page, selectedAreas);
    }

    ruleOptions['pages'][page]['table_areas'] = areas_columns[0];
    ruleOptions['pages'][page]['columns'] = areas_columns[1];
  }

  return ruleOptions;
};

// onevent functions
// table areas

const renderTableAreas = function (page, tableAreas, columns) {
  tableAreas = getTableAreasForRender(page, tableAreas, columns);
  if (tableAreas !== undefined) {
    $('#image-{0}'.format(page)).selectAreas('add', tableAreas);
  }
};

const onDetectAreasClick = (e) => {
  resetTableAreas();
  let flavor = document.getElementById('flavors').value;
  if (flavor == 'Select flavor') {
    for (let page in detectedAreas) {
      let f = '';
      if (detectedAreas[page]['lattice'] != null) {
        f = 'lattice';
      } else {
        f = 'stream';
      }

      renderTableAreas(page, detectedAreas[page][f], []);
      onFlavorChange();
      document.getElementById('flavors').value = f.charAt(0).toUpperCase() + f.slice(1);
    }
  } else {
    for (let page in detectedAreas) {
      renderTableAreas(page, detectedAreas[page][flavor.toLowerCase()], []);
    }
  }
}

const resetTableAreas = () => {
  $('.image-area').each(function () {
    $(this).selectAreas('reset');
  });
  resetColumnSeparators();
};

// columns

const resetColumnSeparators = function () {
  $(".draggable-column").draggable("destroy");
  $(".draggable-column").remove();
};

// flavor select

const onFlavorChange = function () {
  const flavor = document.getElementById('flavors').value;
  if (flavor == 'Lattice') {
    $('.stream').hide();
    $('.lattice').show();
    $('.add-separator').prop('disabled', true);
  } else {
    $('.stream').show();
    $('.lattice').hide();
    $('.add-separator').prop('disabled', false);
  }
};

// view and extract data

const startJob = function () {
  let ruleOptions = {};
  const loc = window.location.pathname.split('/');
  ruleOptions = getRuleOptions();
  $.ajax({
    url: '/ui/jobs',
    data: {
      file_id: loc[loc.length - 1],
      rule_id: globalRuleId || null,
      rule_options: JSON.stringify(ruleOptions)
    },
    type: 'POST',
    success: function (data) {
      const redirectUrl = '{0}//{1}/ui/jobs/{2}'.format(window.location.protocol, window.location.host, data['job_id']);
      window.location.replace(redirectUrl);
    },
    error: function (error) {
      console.error(error);
    }
  });
}

const updateFlavor = function () {
  if ($("#flavors").val() === "Select flavor" || $("#flavors").val() === null) {
    $("#flavors").val("Stream");
    onFlavorChange();
  }
};

$(document).ready(function () {
  updateFlavor();
  $('.image-area').selectAreas({
    onChanging: function(event, id, areas) {
      updateFlavor();
    }
  });
});
