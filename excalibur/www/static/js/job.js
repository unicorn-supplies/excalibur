$(document).ready(function () {
  var loc = window.location.pathname.split('/');

  $(".cell-value-label").droppable({
    accept: ".cell-link-label",
    tolerance: "pointer",
    drop: function(event, ui) {
      let $handle = $(ui.draggable);
      //$handle.remove();
      return;

      let $source = $handle.parents(".droppable-cell");
      let $target = $(event.target);
      let sourcePath = $source.attr("id").replace("cell-", "");
      let targetPath = $target.attr("id").replace("cell-", "");

      let $sourceField = $("#field-" + sourcePath);
      let $sourceLabel = $("#label-" + sourcePath);
      let $sourceValue = $("#value-" + sourcePath);

      let $targetField = $("#field-" + targetPath);
      let $targetLabel = $("#label-" + targetPath);
      let $targetValue = $("#value-" + targetPath);

      if ($handle.hasClass("cell-link-label")) {
        // Dragging label to a field.
        $targetValue.val($sourceLabel.val());
      } else {
        // Dragging field to a label.
        $targetLabel.val($sourceValue.val());
      }
    }
  });

  $(".cell-link-label").draggable({
    helper: "clone",
    containment: "document",
    zIndex: 99999,
    drag: function(event, ui) {
      $(".droppable-cell").removeClass("hovering");

      let $under = $(document.elementFromPoint(event.clientX, event.clientY)).parentsUntil(".droppable-cell").closest("td");
      $under.addClass("hovering");
    }
  });

  const fieldsMap = {
    "invoice": {
      "invoice_id": "String",
      "note": "String",
      "tax_point_date": "Date",
      "document_currency_code": "String",
      "tax_currency_code": "String",
      "accounting_cost": "String",
      "buyer_reference": "String",
      "customer_id": "String",
      "despatch_document_reference": "String",
      "project_reference": "String",
      "supplier_reference": "String",
      "customer_reference": "String",
      "payment_id": "String",
      "payment_terms": "String",
      "period": {
        "start_date": "Date",
        "end_date": "Date"
      },
      "order_reference": {
        "reference_id": "String",
        "sales_order_id": "String"
      },
      "delivery": {
        "actual_delivery_date": "Date",
        "name": "String",
        "address": {
          "address_line": "String",
          "street": "String",
          "additional_street": "String",
          "city": "String",
          "zip": "String",
          "country_subentity": "String",
          "country": "String"
        }
      },
      "allowance_charges": [{
        "reason": "String",
        "percentage": "String",
        "amount": "String",
        "base_amount": "String",
        "tax_category": "String",
        "charge": "Boolean"
      }],
      "tax_totals": [{
        "taxable_amount": "String",
        "tax_amount": "String",
        "tax_percent": "String"
      }],
      "legal_monetary_total": {
        "line_extension_amount": "String",
        "tax_exclusive_amount": "String",
        "tax_inclusive_amount": "String",
        "allowance_total_amount": "String",
        "charge_total_amount": "String",
        "prepaid_amount": "String",
        "payable_rounding_amount": "String",
        "payable_amount": "String"
      },
      "invoice_lines": [{
        "id": "String",
        "note": "String",
        "invoiced_quantity": "String",
        "line_extension_amount": "String",
        "order_line_reference": "String",
        "document_reference": "String",
        "item": {
          "description": "String",
          "name": "String",
          "buyers_item_identification": "String",
          "sellers_item_identification": "String",
          "standard_item_identification": "String",
          "origin_country": "String",
          "tax_percent": "String",
          "additional_item_property": [{
            "name": "String",
            "value": "String"
          }]
        },
        "price": {
          "amount": "String",
          "base_quantity":"String",
          "discount": "String",
          "discount_amount": "String",
          "discount_base_amount": "String"
        },
        "period": {
          "start_date": "Date",
          "end_date": "Date"
        },
        "allowance_charge": [{
          "reason": "String",
          "percentage": "String",
          "amount": "String",
          "charge": "Boolean"
        }]
      }]
    }
  };

  $(".cell-value").on("dblclick", function(e) {
    if ($(this).is("[readonly]")) {
      $(this).removeAttr("readonly");
    } else {
      $(this).attr("readonly", "");
    }
  });

  const makeOption = function(label, value, $parent) {
    let $option = $('<option value="' + value + '">' + label + '</option>');
    $option.appendTo($parent);
    return $option;
  };

  const makeOptGroup = function(label, options, $parent) {
    let $group = $('<optgroup label="' + label + '"></optgroup>');
    let prefix = label + ".";
    $.map(options, function(value, key) {
      if ($.isPlainObject(value)) {
        makeOptGroup(prefix + key, value, $group);
      } else if ($.isArray(value)) {
        for (let i = 0; i < value.length; i++) {
          makeOptGroup(prefix + key, value[i], $group);
        }
      } else {
        makeOption(key, key, $group);
      }
    });
    $group.appendTo($parent);
    return $group;
  };

  $(".fields").each(function(i, el) {
    let $select = $(el);
    $select.empty();
    $("<option>Choose...</option>").appendTo($select);
    $.map(fieldsMap, function(value, key) {
      makeOptGroup(key, value, $select);
    });
  });


  $('#download').click(function () {
    var input = $('<input>', {type: 'hidden', name: 'job_id', val: loc[loc.length - 1]});
    $('#download-form').append($(input));
    $('#download-form').submit();
  });
});
