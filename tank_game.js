/*
  Created by: Anton Debner 2016
*/

var WIDTH=900, HEIGHT=600;
var UpArrow=38, DownArrow=40, LeftArrow=37, RightArrow=39;
var canvas, ctx, keystate;
var tank;
var wall_width = 1;
var cell_size = 50;
var num_cells_x, num_cells_y; // Assigned when cells are created
var cells;

class Cell {

  constructor(x, y, i, j) {
    this.ind_x = i;
    this.ind_y = j;
    this.x = x;
    this.y = y;
    this.right_wall = true;
    this.bottom_wall = true;
  }

  draw() {
    var x = this.x;
    var y = this.y;
    var s = cell_size / 2;
    var w = wall_width / 2;
    if (this.bottom_wall) {
      ctx.fillRect(x-s, y+s-w, s*2, w*2);
    }
    if (this.right_wall) {
      ctx.fillRect(x+s-w, y-s, w*2, s*2);
    }
  }
};

function get_cell_neighbours(x, y) {
  var neighbours = [];
  for (x2 = x - 1; x2 < x + 1; x2++) {
    for (y2 = y - 1; y2 < y + 1; y2++) {
      if (x2 >= 0 && x2 < num_cells_x && y2 >= 0 && y2 < num_cells_y) {
        neighbours.push(cells[x2][y2]);
      }
    }
  }
  return neighbours;
}

function maze_generator_kruskal() {
  /*
    Uses randomized Kruskal's algorithm to generate a maze.
    https://en.wikipedia.org/wiki/Maze_generation_algorithm#Randomized_Kruskal.27s_algorithm
  */

  function shuffle(a) {
    /*
      Shuffles array in place.
      Taken from http://stackoverflow.com/questions/6274339/how-can-i-shuffle-an-array-in-javascript
    */
    var j, x, i;
    for (i = a.length; i; i--) {
      j = Math.floor(Math.random() * i);
      x = a[i - 1];
      a[i - 1] = a[j];
      a[j] = x;
    }
  }

  function find_cell_set(cell, sets) {
    // Finds the set where the given cell is found.
    for (set in sets) {
      if (sets[set].has(cell)) return set;
    }
  }

  function join_cell_sets(cell_1, cell_2, sets) {
    /*
      Checks if given cells are in different sets, joins the sets and returns
      true. Otherwise returns false.
    */
    set_ind1 = find_cell_set(cell_1, sets);
    set_ind2 = find_cell_set(cell_2, sets);
    if (!(set_ind1 === set_ind2)) {
      var joined_set = new Set(function*() {
        yield* sets[set_ind1]; yield* sets[set_ind2]; }()
      );
      delete sets[set_ind1];
      delete sets[set_ind2];
      sets.push(joined_set);
      return true;
    }
    return false;
  }

  // Add all walls to arrays and create a set for each cell
  var right_walls = [];
  var bottom_walls = [];
  var cell_sets = [];
  for (i = 0; i < num_cells_x; i++) {
    for (j = 0; j < num_cells_y; j++) {
      cell = cells[i][j];
      cell_sets.push(new Set([cell]));
      right_walls.push(cell);
      bottom_walls.push(cell);
    }
  }

  // Shuffle walls to randomize the maze
  shuffle(right_walls);
  shuffle(bottom_walls);

  // These variables adjust the proportion of removed horizontal and vertical
  // walls.
  var horiz_prob = 0.6; // value must be 0 < x <= 1
  var vert_prob = 0.9; // value must be 0 < x <= 1
  var remove_anyway_prob = 0.4; // Probability for removing extra walls

  // Remove all walls between disconnected cells
  while (right_walls.length > 0 && bottom_walls.length > 0) {
    if (right_walls.length > 0 && Math.random() < vert_prob) {
      var cell = right_walls.pop();
      if (cell.ind_x + 1 < num_cells_x) {
        next_cell = cells[cell.ind_x+1][cell.ind_y];
        if (join_cell_sets(cell, next_cell, cell_sets)) {
          cell.right_wall = false;
        }
        // Randomly delete the wall anyway
        else if (Math.random() < remove_anyway_prob) cell.right_wall = false;
      }
    }
    if (bottom_walls.length > 0 && Math.random() < horiz_prob) {
      var cell = bottom_walls.pop();
      if (cell.ind_y + 1 < num_cells_y) {
        next_cell = cells[cell.ind_x][cell.ind_y+1];
        if (join_cell_sets(cell, next_cell, cell_sets)) {
          cell.bottom_wall = false;
        }
        // Randomly delete the wall anyway
        else if (Math.random() < remove_anyway_prob) cell.bottom_wall = false;
      }
    }
  }


}

class Tank {

  constructor() {
    this.x = 10;
    this.y = 10;
    this.color = "#000";
    this.size = 10;
    this.dir = 0; // degrees
    this.speed = 1;
    this.turn_speed = 5;
  }

  update() {
    var radians = this.dir * (Math.PI/180);
    if (keystate[UpArrow]) {
      this.x -= this.speed * Math.sin(radians);
      this.y -= this.speed * Math.cos(radians);
    }
    else if (keystate[DownArrow]) {
      this.x += this.speed * Math.sin(radians);
      this.y += this.speed * Math.cos(radians);
    }
    if (keystate[LeftArrow]) {
      this.dir += this.turn_speed;
      if (this.dir >= 360) this.dir -= 360;
    }
    else if (keystate[RightArrow]) {
      this.dir -= this.turn_speed;
      if (this.dir < 0) this.dir += 360;
    }
  }

  draw() {
    var x = this.x;
    var y = this.y;
    var s = this.size/2;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-this.dir * (Math.PI/180));
    ctx.fillRect(-s, -s, s*2, s*2);
    ctx.fillRect(-s/2, -s*2, s, s*2);
    ctx.restore();
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
  cells = [];
  num_cells_x = Math.round(WIDTH / cell_size);
  num_cells_y = Math.round(HEIGHT / cell_size);
  for (i = 0; i < num_cells_x; i++) {
    var x = i * cell_size + cell_size / 2;
    var column = []

    for (j = 0; j < num_cells_y; j++) {
      var y = j * cell_size + cell_size / 2;
      new_cell = new Cell(x, y, i, j);
      column[j] = new_cell;
    }
    cells[i] = column;
  }
  maze_generator_kruskal();
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
  //ctx.save(); // Save current drawing state

  // Draw borders
  ctx.fillStyle = "#000";
  ctx.moveTo(0,0);
  ctx.lineTo(WIDTH, 0);
  ctx.lineTo(WIDTH, HEIGHT);
  ctx.lineTo(0, HEIGHT);
  ctx.lineTo(0, 0);
  ctx.stroke();

  tank.draw();
  num_cells_x = Math.round(WIDTH / cell_size);
  num_cells_y = Math.round(HEIGHT / cell_size);
  for (i = 0; i < num_cells_x; i++) {
    for (j = 0; j < num_cells_y; j++) {
      cells[i][j].draw();
    }
  }


  //ctx.restore(); // Restore saved drawing state
}

main();
