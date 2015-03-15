function PhotosetEditor(photoset, upload, options) {
    'use strict';
    return this.init(photoset, upload, options);
}

if (typeof module === 'object') {
    module.exports = PhotosetEditor;
}
// AMD support
else if (typeof define === 'function' && define.amd) {
    define(function () {
        'use strict';
        return PhotosetEditor;
    });
}

(function (window, document) {
    'use strict';

    function extend(b, a) {
      var prop;
      if (b === undefined) {
        return a;
      }
      for (prop in a) {
        if (a.hasOwnProperty(prop) && b.hasOwnProperty(prop) === false) {
          b[prop] = a[prop];
        }
      }
      return b;
    }

    function distance2PointPoint(x1, y1, x2, y2) {
      return (x1 - x2) * (x1 - x2) + (y1 - y2) * (y1 - y2);
    }

    function distance2SegmentPoint(x1, y1, x2, y2, px, py) {
      // check if segment is actually just a point
      // if yes just return distance to one of the segment points
      var segmentLength2 = distance2PointPoint(x1,y1,x2,y2);
      if (segmentLength2 === 0) return distance2PointPoint(px,py,x1,y1);

      // check if point lies beyond segment
      // if yes just return distance to the closer end point
      var segmentRatio = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / segmentLength2;
      if(segmentRatio < 0) return distance2PointPoint(px,py,x1,y1);
      if(segmentRatio > 1) return distance2PointPoint(px,py,x2,y2);

      // in all other cases calculate distance to projection point
      var qx = x1 + segmentRatio * (x2 - x1);
      var qy = y1 + segmentRatio * (y2 - y1);
      return distance2PointPoint(px, py, qx, qy);
    }

    PhotosetEditor.prototype = {
        defaults: {
            spacing: 9,
        },

        init: function (photoset, upload, options) {
          this.options = extend(options, this.defaults);
          this.options.spacing_middle = Math.ceil(this.options.spacing / 2.0);
          this.points = []
          this.photos = []
          this.dragSource = null;
          this.element = $(photoset);
          if(upload) {
            this.upload = $(upload);
          }
          return this.setup();
        },

        setup: function() {
          var self = this;
          this.markers = {
            'horizontal': this.element.parent().find('.marker.horizontal'),
            'vertical': this.element.parent().find('.marker.vertical'),
          };

          if(self.upload) {
            var dropzone = self.upload.dropzone({
              uploadMultiple: true,
              init: function() {
                this.on("successmultiple", function(files,data) {
                  data = JSON.parse(data);
                  for(var i=0,path;path=data.images[i];i++) {
                    var img = self.wrap(self, path);
                    self.element.append(img);
                    self.photos.push([img]);
                    self.layout();
                  }

                  for(var i=0,file;file=files[i];i++) {
                    this.removeFile(file);
                  }
                });
              }
            });
          }

          self.element.on('dragover', function(e) {
            if(e.preventDefault) {
              e.preventDefault();
            }

            var je = e;
            e = e.originalEvent;
            // console.log("pageX", e.pageX);
            // console.log("pageY", e.pageY);
            // console.log("elemLeft", self.element.offset().left);
            // console.log("elemTop", self.element.offset().top);
            var mouseX = e.pageX - self.element.offset().left;
            var mouseY = e.pageY - self.element.offset().top;
            console.log("mouseX", mouseX);
            console.log("mouseY", mouseY);

            self.markers.horizontal.hide();
            self.markers.vertical.hide();

            var tmp_point = self.getInsertPoint(mouseX, mouseY);
            if(!tmp_point) {
              return false;
            }

            // clone point to avoid changing underlying drop points
            var min_point = $.extend(true, {}, tmp_point);

            min_point.x += self.element.offset().left;
            min_point.y += self.element.offset().top;

            var marker = self.markers[min_point.direction];
            if(min_point.direction === 'horizontal') {
              marker.width(min_point.width);
              marker.css('top', min_point.y - self.options.spacing_middle);
              marker.css('left', min_point.x - min_point.width / 2.0);
              marker.attr('data-row', min_point.row)
            } else if(min_point.direction === 'vertical') {
              marker.height(min_point.height);
              marker.css('left', min_point.x - self.options.spacing_middle);
              marker.css('top', min_point.y - min_point.height / 2.0);
              marker.attr('data-row', min_point.row)
              marker.attr('data-column', min_point.col)
            }
            marker.show();

            return false;
          });

          self.element.on('dragleave', function(e) {
            self.markers.horizontal.hide();
            self.markers.vertical.hide();

            return false;
          });

          self.element.on('dragend', function(e) {
            self.dragSource.css('opacity', 1);
          });

          self.element.on('drop', function(e) {

            if (e.originalEvent.stopPropagation) {
              e.originalEvent.stopPropagation(); // stops the browser from redirecting.
            }

            for(var row_idx = 0; row_idx < self.photos.length; ++row_idx) {
              var photo_row = self.photos[row_idx];
              for(var col_idx = 0; col_idx < photo_row.length; ++col_idx) {
                var photo = photo_row[col_idx];
                if($(self.dragSource).is(photo)) {
                  self.photos[row_idx][col_idx] = null;
                }
              }
            }

            if(self.markers.horizontal.is(":visible")) {
              row_idx = +self.markers.horizontal.attr('data-row');
              if(row_idx === -1) {
                self.photos.unshift([self.dragSource]);
              } else {
                self.photos.splice(row_idx+1,0,[self.dragSource]);
              }
            } else if (self.markers.vertical.is(":visible")) {
              row_idx = +self.markers.vertical.attr('data-row');
              col_idx = +self.markers.vertical.attr('data-column');
              if(col_idx === -1) {
                self.photos[row_idx].unshift(self.dragSource);
              } else {
                self.photos[row_idx].splice(col_idx+1,0,self.dragSource);
              }
            }
            self.markers.horizontal.hide();
            self.markers.vertical.hide();

            // clean
            for(var row_idx = 0; row_idx < self.photos.length; ++row_idx) {
              var photo_row = self.photos[row_idx];
              for(var col_idx = 0; col_idx < photo_row.length; ++col_idx) {
                var photo = photo_row[col_idx];
                if(!photo) {
                  photo_row.splice(col_idx, 1);
                  col_idx -= 1;
                }
              }
              if(photo_row.length <= 0) {
                self.photos.splice(row_idx, 1);
                row_idx -= 1;
              }
            }

            self.layout();

            return false;
          });
        },

        setAll: function(photos) {
          var imgs = this.wrapAll(this, photos);
          this.element.empty();
          this.insertAll(this, imgs);
          this.photos = imgs;
          this.layout();
        },
        insertAll: function(self, imgs) {
          if($.isArray(imgs)) {
            imgs.map(
              function(element) {
                self.insertAll(self, element);
              });
          } else {
            self.element.append(imgs);
          }
        },
        wrapAll: function(self, paths) {
          if($.isArray(paths)) {
            return paths.map(
              function(element) {
                return self.wrapAll(self, element);
              });
          } else {
            return self.wrap(self, paths);
          }
        },
        wrap: function(self, path) {
          var img = $("<img />").attr('src', path).attr('draggable',true);
          img.on('dragstart', function(e) {
            self.dragSource = $(this);
            self.dragSource.css('opacity', .4);
            e.originalEvent.dataTransfer.effectAllowed = 'move';
            e.originalEvent.dataTransfer.dropEffect = 'move';
          });
          return img;
        },

        layout: function() {
          var self = this;
          imagesLoaded(this.element, function() {
            self.points = [];
            var offset_top = 0;
            self.points.push({
              x: self.element.width() / 2.0, y: 0, direction: 'horizontal', width: self.element.width(), height:0, row: -1
            });
            for(var row_idx = 0; row_idx < self.photos.length; ++row_idx) {
              var photo_row = self.photos[row_idx];
              var photo_width = (self.element.width() - self.options.spacing * (photo_row.length - 1)) / photo_row.length;
              var max_row_height = 0;
              var offset_left = 0;

              for(var col_idx = 0; col_idx < photo_row.length; ++col_idx) {
                var photo = photo_row[col_idx];
                var ratio = photo.get(0).naturalHeight / photo.get(0).naturalWidth;
                photo.width(photo_width);

                var photo_height = photo_width * ratio;
                if (photo_height > max_row_height) {
                  max_row_height = photo_height;
                }
              }

              self.points.push({
                x: 0, y: offset_top + max_row_height / 2, direction: 'vertical', width:0, height: max_row_height, row: row_idx, col: -1
              });

              for(var col_idx = 0; col_idx < photo_row.length; ++col_idx) {
                var photo = photo_row[col_idx];
                photo.css('top', offset_top);
                photo.css('left', offset_left);
                offset_left += photo_width + self.options.spacing;

                self.points.push({
                  x: offset_left, y: offset_top + max_row_height / 2, direction: 'vertical', width: 0, height: max_row_height, row: row_idx, col: col_idx
                });
              }

              offset_top += max_row_height + self.options.spacing;
              self.points.push({
                x: self.element.width() / 2.0, y: offset_top, direction: 'horizontal', width: self.element.width(), height:0, row: row_idx
              });
            }

            self.element.height(offset_top);
          });
        },

        getInsertPoint: function(mouseX, mouseY) {
          // find closest point
          var min_distance_squared = Number.MAX_VALUE;
          var min_point = false;
          for(var point_idx = 0; point_idx < this.points.length; ++point_idx) {
            var point = this.points[point_idx];

            var distanceSegment = distance2SegmentPoint(
              point.x - point.width / 2, point.y - point.height / 2,
              point.x + point.width / 2, point.y + point.height / 2,
                mouseX, mouseY)
            if (distanceSegment < min_distance_squared) {
              min_distance_squared = distanceSegment;
              min_point = point;
            }
          }

          return min_point;
        }
    };
}(window, document));
