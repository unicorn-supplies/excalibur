/* global window, Image, jQuery */
/**
 * @author 360Learning
 * @author Catalin Dogaru (https://github.com/cdog - http://code.tutsplus.com/tutorials/how-to-create-a-jquery-image-cropping-plugin-from-scratch-part-i--net-20994)
 * @author Adrien David-Sivelle (https://github.com/AdrienDS - Refactoring, Multiselections & Mobile compatibility)
 */
(function($) {
  $.imageArea = function(parent, id) {
    const area_colors = [
      '#00f',
      '#f00',
      '#0f0',
      '#ff0',
      '#f0f',
      '#0ff',
      '#000',
      '#007',
      '#700',
      '#070',
      '#770',
      '#707',
      '#077'
    ];
    var options = parent.options,
        $image = parent.$image,
        $trigger = parent.$trigger,
        $outline,
        $selection,
        $resizeHandlers = {},
        $btDelete,
        $btMove,
        $btAddCol,
        $column,
        resizeHorizontally = true,
        resizeVertically = true,
        selectionOffset = [0, 0],
        selectionOrigin = [0, 0],
        lastColumnPos = 0,
        area = {
          id: id,
          x: 0,
          y: 0,
          z: 0,
          height: 0,
          width: 0,
          columns: [],
          page: 1,
          setup: {
            flavor: "stream",
            row_tol: 2,
            col_tol: 0,
            split_text: false,
            strip_text: ""
          }
        },
        blur = function () {
          area.z = 0;
          refresh("blur");
        },
        focus = function () {
          parent.blurAll();
          area.z = 100;
          refresh();
        },
        getData = function () {
          return area;
        },
        fireEvent = function (event) {
          $image.trigger(event, [area.id, parent.areas()]);
        },
        cancelEvent = function (e) {
          var event = e || window.event || {};
          event.cancelBubble = true;
          event.returnValue = false;
          event.stopPropagation && event.stopPropagation(); // jshint ignore: line
          event.preventDefault && event.preventDefault(); // jshint ignore: line
        },
        off = function() {
          $.each(arguments, function (key, val) {
            on(val);
          });
        },
        on = function (type, handler) {
          var browserEvent, mobileEvent;
          switch (type) {
            case "start":
              browserEvent = "mousedown";
              mobileEvent = "touchstart";
              break;
            case "move":
              browserEvent = "mousemove";
              mobileEvent = "touchmove";
              break;
            case "stop":
              browserEvent = "mouseup";
              mobileEvent = "touchend";
              break;
            default:
              return;
          }
          if (handler && jQuery.isFunction(handler)) {
            $(window.document).on(browserEvent, handler).on(mobileEvent, handler);
          } else {
            $(window.document).off(browserEvent).off(mobileEvent);
          }
        },
        updateSelection = function () {
          // Update the outline layer
          $outline.css({
            cursor: "default",
            width: area.width,
            height: area.height,
            left: area.x,
            top: area.y,
            "z-index": area.z
          });

          // Update the selection layer
          $selection.css({
            backgroundPosition : ( - area.x - 1) + "px " + ( - area.y - 1) + "px",
            cursor : (options.allowMove && !$btMove) ? "move" : "default",
            width: (area.width - 2 > 0) ? (area.width - 2) : 0,
            height: (area.height - 2 > 0) ? (area.height - 2) : 0,
            left : area.x + 1,
            top : area.y + 1,
            "z-index": area.z + 2
          });


          $selection.prev("div").css({
            "border": "1px dotted {0}".format(area_colors[area.id % area_colors.length])
          });

        },
        updateResizeHandlers = function (show) {
          if (! options.allowResize) {
            return;
          }
          if (show) {
            $.each($resizeHandlers, function(name, $handler) {
              var top,
                  left,
                  semiwidth = Math.round($handler.width() / 2),
                  semiheight = Math.round($handler.height() / 2),
                  vertical = name[0],
                  horizontal = name[name.length - 1];

              if (vertical === "n") {             // ====== North* ======
                top = - semiheight;

              } else if (vertical === "s") {      // ====== South* ======
                top = area.height - semiheight - 1;

              } else {                            // === East & West ===
                top = Math.round(area.height / 2) - semiheight - 1;
              }

              if (horizontal === "e") {           // ====== *East ======
                left = area.width - semiwidth - 1;

              } else if (horizontal === "w") {    // ====== *West ======
                left = - semiwidth;

              } else {                            // == North & South ==
                left = Math.round(area.width / 2) - semiwidth - 1;
              }

              $handler.css({
                display: "block",
                left: area.x + left,
                top: area.y + top,
                "z-index": area.z + 1
              });
            });
          } else {
            $(".select-areas-resize-handler").each(function() {
              $(this).css({ display: "none" });
            });
          }
        },
        updateBtDelete = function (visible) {
          if ($btDelete) {
            $btDelete.css({
              display: visible ? "block" : "none",
              left: area.x + area.width + 1,
              top: area.y - $btDelete.outerHeight() - 1,
              "z-index": area.z + 1
            });
          }
        },
        updateBtMove = function (visible) {
          if ($btMove) {
            $btMove.css({
              display: visible ? "block": "none",
              left: area.x + area.width + 1,
              top: area.y - 1,
              "z-index": area.z + 1
            });
          }
        },
        updateBtAddColumn = function (visible) {
          if ($btAddCol) {
            $btAddCol.css({
              display: visible ? "block": "none",
              left: area.x + area.width + 1,
              top: area.y - 1 + ($btMove ? $btMove.outerHeight() : 0),
              "z-index": area.z + 1
            });
          }
        },
        updateCursor = function (cursorType) {
          $outline.css({
            cursor: cursorType
          });

          $selection.css({
            cursor: cursorType
          });
        },
        refresh = function(sender) {
          switch (sender) {
            case "startSelection":
              parent._refresh();
              updateSelection();
              updateResizeHandlers();
              updateBtDelete(true);
              updateBtMove(true);
              updateBtAddColumn(true);
              break;

            case "pickSelection":
            case "pickResizeHandler":
              updateResizeHandlers(true);
              break;

            case "resizeSelection":
              updateSelection();
              updateResizeHandlers();
              updateCursor("crosshair");
              updateBtDelete(true);
              updateBtMove(true);
              updateBtAddColumn(true);
              break;

            case "moveSelection":
              updateSelection();
              updateResizeHandlers();
              updateCursor("move");
              updateBtDelete(true);
              updateBtMove(true);
              updateBtAddColumn(true);
              break;

            case "blur":
              updateSelection();
              updateResizeHandlers();
              updateBtDelete();
              updateBtMove();
              updateBtAddColumn();
              break;

              //case "releaseSelection":
            default:
              updateSelection();
              updateResizeHandlers(true);
              updateBtDelete(true);
              updateBtMove(true);
              updateBtAddColumn(true);
          }
        },
        startSelection  = function (event) {
          cancelEvent(event);

          // Reset the selection size
          area.width = options.minSize[0];
          area.height = options.minSize[1];
          focus();
          on("move", resizeSelection);
          on("stop", releaseSelection);

          // Get the selection origin
          selectionOrigin = getMousePosition(event);
          if (selectionOrigin[0] + area.width > $image.width()) {
            selectionOrigin[0] = $image.width() - area.width;
          }
          if (selectionOrigin[1] + area.height > $image.height()) {
            selectionOrigin[1] = $image.height() - area.height;
          }
          // And set its position
          area.x = selectionOrigin[0];
          area.y = selectionOrigin[1];

          refresh("startSelection");
        },
        pickSelection = function (event) {
          if (event.target.className.indexOf("move-area") !== -1) {
            cancelEvent(event);
            focus();

            on("move", moveSelection);
            on("stop", releaseSelection);

          } else if (event.target.className.indexOf("column") !== -1) {
            event.stopPropagation();
            return;

          } else {
            cancelEvent(event);
            focus();
            off("move", "stop");
          }

          var mousePosition = getMousePosition(event);

          // Get the selection offset relative to the mouse position
          selectionOffset[0] = mousePosition[0] - area.x;
          selectionOffset[1] = mousePosition[1] - area.y;

          refresh("pickSelection");
        },
        pickResizeHandler = function (event) {
          cancelEvent(event);
          focus();

          var card = event.target.className.split(" ")[1];
          if (card[card.length - 1] === "w") {
            selectionOrigin[0] += area.width;
            area.x = selectionOrigin[0] - area.width;
          }
          if (card[0] === "n") {
            selectionOrigin[1] += area.height;
            area.y = selectionOrigin[1] - area.height;
          }
          if (card === "n" || card === "s") {
            resizeHorizontally = false;
          } else if (card === "e" || card === "w") {
            resizeVertically = false;
          }

          on("move", resizeSelection);
          on("stop", releaseSelection);

          refresh("pickResizeHandler");
        },
        resizeSelection = function (event) {
          cancelEvent(event);
          focus();

          var mousePosition = getMousePosition(event);

          // Get the selection size
          var height = mousePosition[1] - selectionOrigin[1],
              width = mousePosition[0] - selectionOrigin[0];

          // If the selection size is smaller than the minimum size set it to minimum size
          if (Math.abs(width) < options.minSize[0]) {
            width = (width >= 0) ? options.minSize[0] : - options.minSize[0];
          }
          if (Math.abs(height) < options.minSize[1]) {
            height = (height >= 0) ? options.minSize[1] : - options.minSize[1];
          }
          // Test if the selection size exceeds the image bounds
          if (selectionOrigin[0] + width < 0 || selectionOrigin[0] + width > $image.width()) {
            width = - width;
          }
          if (selectionOrigin[1] + height < 0 || selectionOrigin[1] + height > $image.height()) {
            height = - height;
          }
          // Test if the selection size is bigger than the maximum size (ignored if minSize > maxSize)
          if (options.maxSize[0] > options.minSize[0] && options.maxSize[1] > options.minSize[1]) {
            if (Math.abs(width) > options.maxSize[0]) {
              width = (width >= 0) ? options.maxSize[0] : - options.maxSize[0];
            }

            if (Math.abs(height) > options.maxSize[1]) {
              height = (height >= 0) ? options.maxSize[1] : - options.maxSize[1];
            }
          }

          // Set the selection size
          if (resizeHorizontally) {
            area.width = width;
          }
          if (resizeVertically) {
            area.height = height;
          }
          // If any aspect ratio is specified
          if (options.aspectRatio) {
            // Calculate the new width and height
            if ((width > 0 && height > 0) || (width < 0 && height < 0)) {
              if (resizeHorizontally) {
                height = Math.round(width / options.aspectRatio);
              } else {
                width = Math.round(height * options.aspectRatio);
              }
            } else {
              if (resizeHorizontally) {
                height = - Math.round(width / options.aspectRatio);
              } else {
                width = - Math.round(height * options.aspectRatio);
              }
            }
            // Test if the new size exceeds the image bounds
            if (selectionOrigin[0] + width > $image.width()) {
              width = $image.width() - selectionOrigin[0];
              height = (height > 0) ? Math.round(width / options.aspectRatio) : - Math.round(width / options.aspectRatio);
            }

            if (selectionOrigin[1] + height < 0) {
              height = - selectionOrigin[1];
              width = (width > 0) ? - Math.round(height * options.aspectRatio) : Math.round(height * options.aspectRatio);
            }

            if (selectionOrigin[1] + height > $image.height()) {
              height = $image.height() - selectionOrigin[1];
              width = (width > 0) ? Math.round(height * options.aspectRatio) : - Math.round(height * options.aspectRatio);
            }

            // Set the selection size
            area.width = width;
            area.height = height;
          }

          if (area.width < 0) {
            area.width = Math.abs(area.width);
            area.x = selectionOrigin[0] - area.width;
          } else {
            area.x = selectionOrigin[0];
          }
          if (area.height < 0) {
            area.height = Math.abs(area.height);
            area.y = selectionOrigin[1] - area.height;
          } else {
            area.y = selectionOrigin[1];
          }

          fireEvent("changing");
          refresh("resizeSelection");
        },
        moveSelection = function (event) {
          cancelEvent(event);
          if (! options.allowMove) {
            return;
          }
          focus();

          var mousePosition = getMousePosition(event);

          moveTo({
            x: mousePosition[0] - selectionOffset[0],
            y: mousePosition[1] - selectionOffset[1]
          });

          fireEvent("changing");
        },
        moveTo = function (point) {
          // Set the selection position on the x-axis relative to the bounds
          // of the image
          if (point.x > 0) {
            if (point.x + area.width < $image.width()) {
              area.x = point.x;
            } else {
              area.x = $image.width() - area.width;
            }
          } else {
            area.x = 0;
          }
          // Set the selection position on the y-axis relative to the bounds
          // of the image
          if (point.y > 0) {
            if (point.y + area.height < $image.height()) {
              area.y = point.y;
            } else {
              area.y = $image.height() - area.height;
            }
          } else {
            area.y = 0;
          }
          refresh("moveSelection");
        },
        releaseSelection = function (event) {
          cancelEvent(event);
          off("move", "stop");

          // Update the selection origin
          selectionOrigin[0] = area.x;
          selectionOrigin[1] = area.y;

          // Reset the resize constraints
          resizeHorizontally = true;
          resizeVertically = true;

          // Update columns
          area.columns = $(".draggable-column[data-id=" + area.id + "]").toArray().map(
            function(e) {
              return $(e).position().left;
            }
          );
          area.columns.sort(function(a, b) {
            return a - b;
          });

          fireEvent("changed");

          refresh("releaseSelection");
        },
        addColumn = function (event, leftPos) {

          var initialPosition = (leftPos ? leftPos : ((!lastColumnPos ? 25 : lastColumnPos + 25)));

          $column = $('<div class="draggable-column "data-id="{0}" data-page="{1}"><div class="column-line"></div></div>'.format(area.id, area.page)).draggable({
            "containment": $selection,
            "axis": "x",
            "appendTo": $selection,
            "start": function(event, ui) {
              let columnIndex = area.columns.indexOf(ui.position.left);
              if (columnIndex !== -1) {
                area.columns.splice(columnIndex, 1);
                area.columns.sort(function(a, b) {
                  return a - b;
                });
              }
            },
            "drag": function(event, ui) {
              let columnIndex = area.columns.indexOf(ui.position.left);
              if (columnIndex !== -1) {
                area.columns.splice(columnIndex, 1);
                area.columns.sort(function(a, b) {
                  return a - b;
                });
              }
            },
            "stop": function(event, ui) {
              let columnIndex = area.columns.indexOf(ui.position.left);
              if (columnIndex === -1) {
                area.columns.push(ui.position.left);
                area.columns.sort(function(a, b) {
                  return a - b;
                });
              }
            },
            "create": function(event, ui) {
              let position = $(event.target).position().left || initialPosition;
              let columnIndex = area.columns.indexOf(position);
              if (columnIndex === -1) {
                area.columns.push(position);
                area.columns.sort(function(a, b) {
                  return a - b;
                });
              }
            }
          }).css({
            "top": "0px",
            "left": initialPosition + "px",
            "min-height": "100%",
            "z-index": area.z * 2
          }).bind("dblclick", function(event) {
            let columnIndex = area.columns.indexOf($(this).position().left);
            if (columnIndex !== -1) {
              area.columns.splice(columnIndex, 1);
              area.columns.sort(function(a, b) {
                return a - b;
              });
            }
            $(this).remove();
          });
          $selection.append($column);

          $column.find(".column-line").css({
            "border-left-color": area_colors[area.id % area_colors.length],
            "opacity": 1.0
          });

          $selection.prev("div").css({
            "border": "1px dotted {0}".format(area_colors[area.id % area_colors.length]),
          });

          lastColumnPos = $column.position().left;

          if (event) {
            // Done interactively.
            cancelEvent(event);
          } else {
            // Called with initial areas/columns.
            if (area.columns.indexOf(leftPos) === -1) {
              area.columns.push(leftPos);
              area.columns.sort(function(a, b) {
                return a - b;
              });
            }
          }
        },
        deleteSelection = function (event) {
          cancelEvent(event);
          $selection.remove();
          $outline.remove();
          $.each($resizeHandlers, function(card, $handler) {
            $handler.remove();
          });
          if ($btDelete) {
            $btDelete.remove();
          }
          if ($btMove) {
            $btMove.remove();
          }
          if ($btAddCol) {
            $btAddCol.remove();
          }
          fireEvent("deleted");
          parent._remove(id);
          fireEvent("changed");
        },
        getElementOffset = function (object) {
          var offset = $(object).offset();

          return [offset.left, offset.top];
        },
        getMousePosition = function (event) {
          var imageOffset = getElementOffset($image);

          if (! event.pageX) {
            if (event.originalEvent) {
              event = event.originalEvent;
            }

            if(event.changedTouches) {
              event = event.changedTouches[0];
            }

            if(event.touches) {
              event = event.touches[0];
            }
          }
          var x = event.pageX - imageOffset[0],
              y = event.pageY - imageOffset[1];

          x = (x < 0) ? 0 : (x > $image.width()) ? $image.width() : x;
          y = (y < 0) ? 0 : (y > $image.height()) ? $image.height() : y;

          return [x, y];
        };


    // Initialize an outline layer and place it above the trigger layer
    $outline = $("<div class=\"select-areas-outline\" />")
      .css({
        opacity : options.outlineOpacity,
        position : "absolute"
      })
      .insertAfter($trigger);

    // Initialize a selection layer and place it above the outline layer
    $selection = $("<div />")
      .addClass("select-areas-background-area")
      .css({
        background : "#fff url(" + $image.attr("src") + ") no-repeat",
        backgroundSize : $image.width() + "px " + $image.height() + "px",
        position : "absolute"
      })
      .insertAfter($outline);

    // Initialize all handlers
    if (options.allowResize) {
      $.each(["nw", "n", "ne", "e", "se", "s", "sw", "w"], function (key, card) {
        $resizeHandlers[card] =  $("<div class=\"select-areas-resize-handler " + card + "\"/>")
          .css({
            opacity : 0.5,
            position : "absolute",
            cursor : card + "-resize"
          })
          .insertAfter($selection)
          .mousedown(pickResizeHandler)
          .bind("touchstart", pickResizeHandler);
      });
    }
    // initialize delete button
    if (options.allowDelete) {
      var bindToDelete = function ($obj) {
        $obj.click(deleteSelection)
            .bind("touchstart", deleteSelection)
            .bind("tap", deleteSelection);
        return $obj;
      };
      $btDelete = bindToDelete($("<div class=\"delete-area\" />"))
        .append(bindToDelete($("<div class=\"select-areas-delete-area\" />")))
        .insertAfter($selection);
    }

    // initialize move button
    if (options.allowMove) {
      var bindToMove = function ($obj) {
        $obj.mousedown(pickSelection)
            .bind("touchstart", pickSelection)
        return $obj;
      };
      $btMove = bindToMove($("<div class=\"move-area\" />"))
        .append(bindToMove($("<div class=\"select-areas-move-area\" />")))
        .insertAfter($selection);

      $selection.mousedown(pickSelection).bind("touchstart", pickSelection);
    }

    // initialize add column button
    if (options.allowAddColumn) {
      var bindToAddColumn = function ($obj) {
        $obj.click(addColumn)
            .bind("touchstart", addColumn)
            .bind("tap", addColumn);
        return $obj;
      };
      $btAddCol = bindToAddColumn($("<div class=\"add-column\" />"))
        .append(bindToAddColumn($("<div class=\"select-areas-add-column\" />")))
        .insertAfter($selection);
    }

    focus();

    return {
      getData: getData,
      startSelection: startSelection,
      deleteSelection: deleteSelection,
      options: options,
      blur: blur,
      focus: focus,
      nudge: function (point) {
        point.x = area.x;
        point.y = area.y;
        if (point.d) {
          point.y = area.y + point.d;
        }
        if (point.u) {
          point.y = area.y - point.u;
        }
        if (point.l) {
          point.x = area.x - point.l;
        }
        if (point.r) {
          point.x = area.x + point.r;
        }
        moveTo(point);
        fireEvent("changed");
      },
      set: function (dimensions, silent) {
        area = $.extend(area, dimensions);
        selectionOrigin[0] = area.x;
        selectionOrigin[1] = area.y;
        if (! silent) {
          fireEvent("changed");
        }

        if (area.columns.length) {
          for (col of area.columns) {
            col = Number(col);
            addColumn(null, col);
          }
        }
      },
      contains: function (point) {
        return (point.x >= area.x) && (point.x <= area.x + area.width) &&
               (point.y >= area.y) && (point.y <= area.y + area.height);
      }
    };
  };


  $.imageSelectAreas = function() { };

  $.imageSelectAreas.prototype.init = function (object, customOptions) {
    var that = this,
        defaultOptions = {
          allowEdit: true,
          allowMove: true,
          allowResize: true,
          allowSelect: true,
          allowDelete: true,
          allowNudge: true,
          allowAddColumn: true,
          aspectRatio: 0,
          minSize: [0, 0],
          maxSize: [0, 0],
          width: 0,
          maxAreas: 0,
          outlineOpacity: 0.5,
          overlayOpacity: 0.5,
          areas: [],
          onChanging: null,
          onChanged: null,
          onDeleted: null
        };

    this.options = $.extend(defaultOptions, customOptions);

    if (! this.options.allowEdit) {
      this.options.allowSelect = this.options.allowMove = this.options.allowResize = this.options.allowDelete = false;
    }

    this._areas = {};

    // Initialize the image layer
    this.$image = $(object);

    this.ratio = 1;
    if (this.options.width && this.$image.width() && this.options.width !== this.$image.width()) {
      this.ratio = this.options.width / this.$image.width();
      this.$image.width(this.options.width);
    }

    if (this.options.onChanging) {
      this.$image.on("changing", this.options.onChanging);
    }
    if (this.options.onChanged) {
      this.$image.on("changed", this.options.onChanged);
    }
    if (this.options.onDeleted) {
      this.$image.on("deleted", this.options.onDeleted);
    }
    if (this.options.onLoaded) {
      this.$image.on("loaded", this.options.onLoaded);
    }

    // Initialize an image holder
    this.$holder = $("<div />")
      .css({
        position : "relative",
        width: this.$image.width(),
        height: this.$image.height()
      });

    // Wrap the holder around the image
    this.$image.wrap(this.$holder)
        .css({
          position : "absolute"
        });

    // Initialize an overlay layer and place it above the image
    this.$overlay = $("<div class=\"select-areas-overlay\" />")
      .css({
        opacity : this.options.overlayOpacity,
        position : "absolute",
        width: this.$image.width(),
        height: this.$image.height()
      })
      .insertAfter(this.$image);

    // Initialize a trigger layer and place it above the overlay layer
    this.$trigger = $("<div />")
      .css({
        backgroundColor : "#000000",
        opacity : 0,
        position : "absolute",
        width: this.$image.width(),
        height: this.$image.height()
      })
      .insertAfter(this.$overlay);

    $.each(this.options.areas, function (key, area) {
      that._add(area, true);
    });


    this.blurAll();
    this._refresh();

    if (this.options.allowSelect) {
      // Bind an event handler to the "mousedown" event of the trigger layer
      this.$trigger.mousedown($.proxy(this.newArea, this)).on("touchstart", $.proxy(this.newArea, this));
    }
    if (this.options.allowNudge) {
      $('html').keydown(function (e) { // move selection with arrow keys
        var codes = {
          37: "l",
          38: "u",
          39: "r",
          40: "d"
        },
            direction = codes[e.which],
            selectedArea;

        if (direction) {
          that._eachArea(function (area) {
            if (area.getData().z === 100) {
              selectedArea = area;
              return false;
            }
          });
          if (selectedArea) {
            var move = {};
            move[direction] = 1;
            selectedArea.nudge(move);
          }
        }
      });
    }
  };

  $.imageSelectAreas.prototype._refresh = function () {
    var nbAreas = this.areas().length;
    this.$overlay.css({
      display : nbAreas? "block" : "none"
    });
    if (nbAreas) {
      this.$image.addClass("blurred");
    } else {
      this.$image.removeClass("blurred");
    }
    this.$trigger.css({
      cursor : this.options.allowSelect ? "crosshair" : "default"
    });
  };

  $.imageSelectAreas.prototype._eachArea = function (cb) {
    $.each(this._areas, function (id, area) {
      if (area) {
        return cb(area, id);
      }
    });
  };

  $.imageSelectAreas.prototype._remove = function (id) {
    delete this._areas[id];
    this._refresh();
  };

  $.imageSelectAreas.prototype.remove = function (id) {
    if (this._areas[id]) {
      this._areas[id].deleteSelection();
    }
  };

  $.imageSelectAreas.prototype.newArea = function (event) {
    var id = -1;
    this.blurAll();
    if (this.options.maxAreas && this.options.maxAreas <=  this.areas().length) {
      return id;
    }
    this._eachArea(function (area, index) {
      id = Math.max(id, parseInt(index, 10));
    });
    id += 1;

    this._areas[id] = $.imageArea(this, id);
    if (event) {
      this._areas[id].startSelection(event);
    }
    return id;
  };

  $.imageSelectAreas.prototype.set = function (id, options, silent) {
    if (this._areas[id]) {
      options.id = id;
      this._areas[id].set(options, silent);
      this._areas[id].focus();
    }
  };

  $.imageSelectAreas.prototype._add = function (options, silent) {
    var id = this.newArea();
    this.set(id, options, silent);
  };

  $.imageSelectAreas.prototype.add = function (options) {
    var that = this;
    this.blurAll();
    if ($.isArray(options)) {
      $.each(options, function (key, val) {
        that._add(val);
      });
    } else {
      this._add(options);
    }
    this._refresh();
    if (! this.options.allowSelect && ! this.options.allowMove && ! this.options.allowResize && ! this.options.allowDelete && ! this.allowAddColumn) {
      this.blurAll();
    }
  };

  $.imageSelectAreas.prototype.reset = function () {
    var that = this;
    this._eachArea(function (area, id) {
      that.remove(id);
    });
    this._refresh();
  };

  $.imageSelectAreas.prototype.destroy = function () {
    this.reset();
    this.$holder.remove();
    this.$overlay.remove();
    this.$trigger.remove();
    this.$image.css("width", "").css("position", "").unwrap();
    this.$image.removeData("mainImageSelectAreas");
    this.$image.off('changing changed loaded');
  };

  $.imageSelectAreas.prototype.areas = function () {
    var ret = [];
    this._eachArea(function (area) {
      ret.push(area.getData());
    });
    return ret;
  };

  $.imageSelectAreas.prototype.relativeAreas = function () {
    var areas = this.areas(),
        ret = [],
        ratio = this.ratio,
        scale = function (val) {
          return Math.floor(val / ratio);
        };

    for (var i = 0; i < areas.length; i++) {
      ret[i] = $.extend({}, areas[i]);
      ret[i].x = scale(ret[i].x);
      ret[i].y = scale(ret[i].y);
      ret[i].width = scale(ret[i].width);
      ret[i].height = scale(ret[i].height);
    }
    return ret;
  };

  $.imageSelectAreas.prototype.blurAll = function () {
    this._eachArea(function (area) {
      area.blur();
    });
  };

  $.imageSelectAreas.prototype.contains  = function (point) {
    var res = false;
    this._eachArea(function (area) {
      if (area.contains(point)) {
        res = true;
        return false;
      }
    });
    return res;
  };

  $.selectAreas = function(object, options) {
    var $object = $(object);
    if (! $object.data("mainImageSelectAreas")) {
      var mainImageSelectAreas = new $.imageSelectAreas();
      mainImageSelectAreas.init(object, options);
      $object.data("mainImageSelectAreas", mainImageSelectAreas);
      $object.trigger("loaded");
    }
    return $object.data("mainImageSelectAreas");
  };


  $.fn.selectAreas = function(customOptions) {
    if ( $.imageSelectAreas.prototype[customOptions] ) { // Method call
      var ret = $.imageSelectAreas.prototype[ customOptions ].apply( $.selectAreas(this), Array.prototype.slice.call( arguments, 1 ));
      return typeof ret === "undefined" ? this : ret;

    } else if ( typeof customOptions === "object" || ! customOptions ) { // Initialization
      //Iterate over each object
      this.each(function() {
        var currentObject = this,
            image = new Image();

        // And attach selectAreas when the object is loaded
        image.onload = function() {
          $.selectAreas(currentObject, customOptions);
        };

        // Reset the src because cached images don"t fire load sometimes
        image.src = currentObject.src;

      });
      return this;

    } else {
      $.error( "Method " +  customOptions + " does not exist on jQuery.selectAreas" );
    }
  };
}) (jQuery);
