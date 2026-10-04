/* Input: keyboard (WASD / arrows) + floating drag stick (touch & mouse).
   Produces one direction vector of length 0..1. */
(function (NS) {
  'use strict';

  var KEYS = {
    KeyW: 'up', ArrowUp: 'up',
    KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right'
  };

  var STICK_RADIUS = 36; // css px of drag for full speed (short: full speed comes quickly)
  var DEAD_ZONE = 5;

  function Input(surface) {
    this.surface = surface;
    this.enabled = false;
    this.held = {};
    this.pointer = { active: false, id: null, ox: 0, oy: 0, x: 0, y: 0 };
    this.stickRadius = STICK_RADIUS;
    this._bind();
  }

  var P = Input.prototype;

  P._local = function (e) {
    var r = this.surface.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  P._bind = function () {
    var self = this, s = this.surface;

    window.addEventListener('keydown', function (e) {
      var dir = KEYS[e.code];
      if (!dir) return;
      if (self.enabled) e.preventDefault();
      self.held[dir] = true;
    });
    window.addEventListener('keyup', function (e) {
      var dir = KEYS[e.code];
      if (dir) self.held[dir] = false;
    });
    window.addEventListener('blur', function () { self.reset(); });

    s.addEventListener('pointerdown', function (e) {
      if (!self.enabled || self.pointer.active) return;
      e.preventDefault();
      var q = self._local(e), p = self.pointer;
      p.active = true; p.id = e.pointerId;
      p.ox = p.x = q.x; p.oy = p.y = q.y;
      try { s.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    });
    s.addEventListener('pointermove', function (e) {
      var p = self.pointer;
      if (!p.active || e.pointerId !== p.id) return;
      var q = self._local(e);
      p.x = q.x; p.y = q.y;
      // Floating origin: drag far and the stick follows, so direction changes stay instant.
      var dx = p.x - p.ox, dy = p.y - p.oy, len = Math.hypot(dx, dy), max = STICK_RADIUS * 1.35;
      if (len > max) { p.ox = p.x - dx / len * max; p.oy = p.y - dy / len * max; }
    });
    function end(e) { if (e.pointerId === self.pointer.id) self._releasePointer(); }
    s.addEventListener('pointerup', end);
    s.addEventListener('pointercancel', end);
    s.addEventListener('lostpointercapture', end);
    s.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  };

  P._releasePointer = function () { this.pointer.active = false; this.pointer.id = null; };

  P.reset = function () { this.held = {}; this._releasePointer(); };

  P.vector = function () {
    var h = this.held;
    var kx = (h.right ? 1 : 0) - (h.left ? 1 : 0);
    var ky = (h.down ? 1 : 0) - (h.up ? 1 : 0);
    if (kx || ky) {
      var kl = Math.hypot(kx, ky);
      return { x: kx / kl, y: ky / kl };
    }
    var p = this.pointer;
    if (!p.active) return { x: 0, y: 0 };
    var dx = p.x - p.ox, dy = p.y - p.oy, len = Math.hypot(dx, dy);
    if (len < DEAD_ZONE) return { x: 0, y: 0 };
    var m = Math.min(1, (len - DEAD_ZONE) / (STICK_RADIUS - DEAD_ZONE));
    return { x: dx / len * m, y: dy / len * m };
  };

  NS.Input = Input;
})(window.CAVIAR = window.CAVIAR || {});
