(function() {
    // constants
    var HASH = '#',
        BEFORE_DRAW ='beforeDraw',
        DRAW = 'draw',

        /*
         * 2 - 3 - 4
         * |       |
         * 1 - 0   5
         *         |
         * 8 - 7 - 6     
         */
        INTERSECTION_OFFSETS = [
            {x:  0, y:  0}, // 0
            {x: -1, y:  0}, // 1
            {x: -1, y: -1}, // 2
            {x:  0, y: -1}, // 3
            {x:  1, y: -1}, // 4
            {x:  1, y:  0}, // 5
            {x:  1, y:  1}, // 6
            {x:  0, y:  1}, // 7
            {x: -1, y:  1}  // 8
        ],
        INTERSECTION_OFFSETS_LEN = INTERSECTION_OFFSETS.length;


    Kinetic.Util.addMethods(Kinetic.Layer, {
        ____init: function(config) {
            this.nodeType = 'Layer';
            this.canvas = new Kinetic.SceneCanvas(config);
            this.hitCanvas = new Kinetic.HitCanvas();
            // call super constructor
            Kinetic.BaseLayer.call(this, config);
        },
        setSize: function(width, height) {
            Kinetic.BaseLayer.prototype.setSize.call(this, width, height);
            this.hitCanvas.setSize(width, height);
        },
        setHeight: function(height) {
            Kinetic.BaseLayer.prototype.setHeight.call(this, height);
            this.hitCanvas.setHeight(height);
        },
        setWidth: function(width) {
            Kinetic.BaseLayer.prototype.setWidth.call(this, width);
            this.hitCanvas.setWidth(width);
        },
        _validateAdd: function(child) {
            var type = child.getType();
            if (type !== 'Group' && type !== 'Shape') {
                Kinetic.Util.error('You may only add groups and shapes to a layer.');
            }
        },
        /**
         * get visible intersection shape. This is the preferred
         * method for determining if a point intersects a shape or not
         * @method
         * @memberof Kinetic.Layer.prototype
         * @param {Object} pos
         * @param {Number} pos.x
         * @param {Number} pos.y
         * @returns {Kinetic.Shape}
         */
        getIntersection: function(pos) {
            var obj, i, intersectionOffset, shape;

            if (this.hitGraphEnabled() && this.isVisible()) {
                // in some cases antialiased area may be bigger than 1px
                // it is possible if we will cache node, then scale it a lot
                // TODO: check { 0; 0 } point before loop, and remove it from INTERSECTION_OFFSETS.
                var spiralSearchDistance = 1;
                var continueSearch = false;
                while (true) {
                    for (i=0; i<INTERSECTION_OFFSETS_LEN; i++) {
                        intersectionOffset = INTERSECTION_OFFSETS[i];
                        obj = this._getIntersection({
                            x: pos.x + intersectionOffset.x * spiralSearchDistance,
                            y: pos.y + intersectionOffset.y * spiralSearchDistance
                        });
                        shape = obj.shape;
                        if (shape) {
                            return shape;
                        }
                        // we should continue search if we found antialiased pixel
                        // that means our node somewhere very close
                        else if (obj.antialiased) {
                            continueSearch = true;
                        }
                    }
                    // if no shape, and no antialiased pixel, we should end searching 
                    if (continueSearch) {
                        spiralSearchDistance += 1;
                    } else {
                        return;
                    }
                }
            } else {
                return null;
            }
        },
        _getIntersection: function(pos) {
            var p = this.hitCanvas.context.getImageData(pos.x, pos.y, 1, 1).data,
                p3 = p[3],
                colorKey, shape;

            // fully opaque pixel
            if(p3 === 255) {
                colorKey = Kinetic.Util._rgbToHex(p[0], p[1], p[2]);
                shape = Kinetic.shapes[HASH + colorKey];
                return {
                    shape: shape
                };
            }
            // antialiased pixel
            else if(p3 > 0) {
                return {
                    antialiased: true
                };
            }
            // empty pixel
            else {
                return {};
            }
        },
        drawScene: function(can, top) {
            var layer = this.getLayer(),
                canvas = can || (layer && layer.getCanvas());

            if (this.shouldDrawScene(canvas)) {

                this._fire(BEFORE_DRAW, {
                    node: this
                });

                if (this.getClearBeforeDraw()) {
                    canvas.getContext().clear();
                }

                Kinetic.Container.prototype.drawScene.call(this, canvas, top);

                this._fire(DRAW, {
                    node: this
                });
            }
            return this;
        },
        // the apply transform method is handled by the Layer and FastLayer class
        // because it is up to the layer to decide if an absolute or relative transform
        // should be used
        _applyTransform: function(shape, context, top) {
            var m = shape.getAbsoluteTransform(top).getMatrix();
            context.transform(m[0], m[1], m[2], m[3], m[4], m[5]);
        },
        drawHit: function(can, top) {
            var layer = this.getLayer(),
                canvas = can || (layer && layer.getHitCanvas());

            if (this.shouldDrawHit(canvas)) {
                if (this.getClearBeforeDraw()) {
                    canvas.getContext().clear();
                }

                Kinetic.Container.prototype.drawHit.call(this, canvas, top);
            }
            return this;
        },
        /**
         * clear scene and hit canvas contexts tied to the layer
         * @method
         * @memberof Kinetic.Layer.prototype
         * @param {Object} [bounds]
         * @param {Number} [bounds.x]
         * @param {Number} [bounds.y]
         * @param {Number} [bounds.width]
         * @param {Number} [bounds.height]
         * @example
         * layer.clear();
         * layer.clear(0, 0, 100, 100);
         */
        clear: function(bounds) {
            this.getContext().clear(bounds);
            this.getHitCanvas().getContext().clear(bounds);
            return this;
        },
        // extend Node.prototype.setVisible
        setVisible: function(visible) {
            //Kinetic.Node.prototype.setVisible.call(this, visible);
            this.attrs.visible = visible;
            if (visible) {
                this.getCanvas().show();
                //this.getHitCanvas().show();
            }
            else {
                this.getCanvas().hide();
                //this.getHitCanvas().hide();
            }
            return this;
        },
        /**
         * enable hit graph
         * @method
         * @memberof Kinetic.Layer.prototype
         * @returns {Layer}
         */
        enableHitGraph: function() {
            this.setHitGraphEnabled(true);
            return this;
        },
        /**
         * disable hit graph
         * @method
         * @memberof Kinetic.Layer.prototype
         * @returns {Layer}
         */
        disableHitGraph: function() {
            this.setHitGraphEnabled(false);
            return this;
        }
    });
    Kinetic.Util.extend(Kinetic.Layer, Kinetic.BaseLayer);

    Kinetic.Factory.addGetterSetter(Kinetic.Layer, 'hitGraphEnabled', true);
    /**
     * @name getHitGraphEnabled
     * @method
     * @memberof Kinetic.Layer.prototype
     * @returns {Boolean}
     */
    /**
     * @name setHitGraphEnabled
     * @method
     * @memberof Kinetic.Layer.prototype
     * @param {Boolean} enabled
     * @returns {Boolean}
     */
    /**
     * get/set hitGraphEnabled flag.  Disabling the hit graph will greatly increase
     *  draw performance because the hit graph will not be redrawn each time the layer is
     *  drawn.  This, however, also disables mouse/touch event detection
     * @name hitGraphEnabled
     * @method
     * @memberof Kinetic.Layer.prototype
     * @param {Boolean} enabled
     * @returns {Boolean}
     * @example
     * // get hitGraphEnabled flag
     * var hitGraphEnabled = layer.hitGraphEnabled();
     *
     * // disable hit graph
     * layer.hitGraphEnabled(false);
     *
     * // enable hit graph
     * layer.hitGraphEnabled(true);
     */
    Kinetic.Collection.mapMethods(Kinetic.Layer);
})();
