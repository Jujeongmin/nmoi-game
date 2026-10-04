/* Input: keyboard (WASD / arrows) + a floating stick for mouse and finger.
   Both give a direction vector of length 0..1. The stick: press anywhere (a thumb low on the
   screen never covers the member), pull the way to go; full speed STICK_RADIUS px out, the
   same speed as the keys, and it stops the moment the button / finger lifts. */
(function (NS) {
  'use strict';

  var KEYS = {
    KeyW: 'up', ArrowUp: 'up',
    KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right'
  };

  var STICK_RADIUS = 36;   // stick: css px of pull for full speed
  var DEAD_ZONE = 5;

  function Input(surface) {
    this.surface = surface;
    this.enabled = false;
    this.held = {};
    this.pointer = { active: false, id: null, x: 0, y: 0, ox: 0, oy: 0 };
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
      p.x = p.ox = q.x; p.y = p.oy = q.y;
      try { s.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    });
    s.addEventListener('pointermove', function (e) {
      var p = self.pointer;
      if (!p.active || e.pointerId !== p.id) return;
      var q = self._local(e);
      p.x = q.x; p.y = q.y;
      // A floating centre: pull far and it follows, so turning stays instant.
      var sx = p.x - p.ox, sy = p.y - p.oy, sl = Math.hypot(sx, sy), max = STICK_RADIUS * 1.35;
      if (sl > max) { p.ox = p.x - sx / sl * max; p.oy = p.y - sy / sl * max; }
    });
    function end(e) { if (e.pointerId === self.pointer.id) self._releasePointer(); }
    s.addEventListener('pointerup', end);
    s.addEventListener('pointercancel', end);
    s.addEventListener('lostpointercapture', end);
    s.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  };

  P._releasePointer = function () { this.pointer.active = false; this.pointer.id = null; };

  P.reset = function () { this.held = {}; this._releasePointer(); };

  /** This frame's direction { x, y } (length 0..1): the keys, or else the stick. */
  P.take = function () {
    var h = this.held, p = this.pointer, out = { x: 0, y: 0 };
    if (p.active) {
      var sx = p.x - p.ox, sy = p.y - p.oy, sl = Math.hypot(sx, sy);
      if (sl >= DEAD_ZONE) {
        var m = Math.min(1, (sl - DEAD_ZONE) / (STICK_RADIUS - DEAD_ZONE));
        out.x = sx / sl * m; out.y = sy / sl * m;
      }
    }
    var kx = (h.right ? 1 : 0) - (h.left ? 1 : 0);
    var ky = (h.down ? 1 : 0) - (h.up ? 1 : 0);
    if (kx || ky) {
      var kl = Math.hypot(kx, ky);
      out.x = kx / kl; out.y = ky / kl;
    }
    return out;
  };

  NS.Input = Input;
})(window.CAVIAR = window.CAVIAR || {});
