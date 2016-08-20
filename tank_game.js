/*
  Created by: Anton Debner 2016
*/

var WIDTH=1000, HEIGHT=600, pi=Math.PI;
var UpArrow=38, DownArrow=40, LeftArrow=37, RightArrow=39;
var canvas, ctx, keystate;
var tank;

class Tank {

  constructor() {
    this.x = 10;
    this.y = 10;
    this.color = "#000";
    this.size = 10;
  }

  update() {
    if (keystate[UpArrow]) this.y -= 1;
    else if (keystate[DownArrow]) this.y += 1;
    if (keystate[LeftArrow]) this.x -= 1;
    else if (keystate[RightArrow]) this.x += 1;
  }

  draw() {
    var x = this.x;
    var y = this.y;
    var s = this.size/2;
    ctx.fillRect(x-s, y-s, s*2, s*2);
  }

};

function main() {
  /*
    Creates a new HTML5 canvas element, adds listeners for input and
    contains the main loop.
  */
  canvas = document.createElement("canvas")
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  ctx = canvas.getContext("2d");

  // Attempt to find a document element with specific id, otherwise attach the
  // canvas to document body.
  attach_to = document.getElementById('game_window');
  if (attach_to == null)
  {
      attach_to = document.body;
  }
  attach_to.appendChild(canvas);

  // Add listeners for keydown and keyup
  keystate = {};
  document.addEventListener("keydown", function(evt) {
    if (evt.keyCode === UpArrow || evt.keyCode === DownArrow) {
      // Prevent up and down arrows from scrolling the website
      evt.preventDefault();
    }
    keystate[evt.keyCode] = true;
  });

  document.addEventListener("keyup", function(evt) {
    delete keystate[evt.keyCode];
  });

  tank = new Tank();

  init();
  var loop = function() {
    /*
      The main loop where all the magic happens.
    */
    update();
    draw();
    window.requestAnimationFrame(loop, canvas);
  };
  window.requestAnimationFrame(loop, canvas);
}

function init() {
  /*
    Sets gameobjects to their starting values.
  */
  keystate = {}; // Reset the keystate to avoid stuck buttons
}

function update() {
  /*
    Handles game logic by moving all objects and checking collisions.
  */
  tank.update();
}

function draw() {
  /*
    Handles all drawing on the HTML5 canvas.
  */
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  ctx.save(); // Save current drawing state

  // Draw borders
  ctx.fillStyle = "#000";
  ctx.moveTo(0,0);
  ctx.lineTo(WIDTH, 0);
  ctx.lineTo(WIDTH, HEIGHT);
  ctx.lineTo(0, HEIGHT);
  ctx.lineTo(0, 0);
  ctx.stroke();

  tank.draw();

  ctx.restore(); // Restore saved drawing state
}

main();
