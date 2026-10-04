/* Input: keyboard (WASD / arrows) + finger / mouse drag.
   Keyboard gives a direction vector of length 0..1. A drag moves the member by the
   distance the finger moved (relative, from anywhere on the stage), so the finger
   never has to cover the member and the move is immediate. */
(function (NS) {
  'use strict';

  var KEYS = {
    KeyW: 'up', ArrowUp: 'up',
    KeyS: 'down', ArrowDown: 'down',
    KeyA: 'left', ArrowLeft: 'left',
    KeyD: 'right', ArrowRight: 'right'
  };

  function Input(surface) {
    this.surface = surface;
    this.enabled = false;
    this.held = {};
    this.pointer = { active: false, id: null, x: 0, y: 0, dx: 0, dy: 0 };
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
      p.x = q.x; p.y = q.y; p.dx = p.dy = 0;
      try { s.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    });
    s.addEventListener('pointermove', function (e) {
      var p = self.pointer;
      if (!p.active || e.pointerId !== p.id) return;
      var q = self._local(e);
      p.dx += q.x - p.x; p.dy += q.y - p.y;   // collected until the next frame takes it
      p.x = q.x; p.y = q.y;
    });
    function end(e) { if (e.pointerId === self.pointer.id) self._releasePointer(); }
    s.addEventListener('pointerup', end);
    s.addEventListener('pointercancel', end);
    s.addEventListener('lostpointercapture', end);
    s.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  };

  P._releasePointer = function () { var p = this.pointer; p.active = false; p.id = null; p.dx = p.dy = 0; };

  P.reset = function () { this.held = {}; this._releasePointer(); };

  /** This frame's input: { x, y } keyboard direction, plus { drag, dx, dy } in CSS px
      while a finger / mouse button is down (the drag since the last call). */
  P.take = function () {
    var h = this.held, p = this.pointer, out = { x: 0, y: 0, drag: p.active, dx: p.dx, dy: p.dy };
    p.dx = p.dy = 0;
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
