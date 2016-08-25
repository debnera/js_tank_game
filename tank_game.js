/*
  Created by: Anton Debner 2016
*/

var WIDTH=900, HEIGHT=600;
var UpArrow=38, DownArrow=40, LeftArrow=37, RightArrow=39;
var canvas, ctx, keystate;
var TANK_SIZE = 10;
var TANK_SPEED = 1;
var TANK_TURN_SPEED = 5;
var wall_width = 2;
var cell_size = 50;
var num_cells_x, num_cells_y; // Assigned when cells are created
var cells;
var game_objects;

class GameObject {
  constructor(x, y, width, height, movable, physics) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.rotation = 0;
    this.velocity = new Object();
    this.velocity.x = 0;
    this.velocity.y = 0;
    this.movable = movable;
    this.physics = physics;
    this.color = "#000";
  }

  get_rect(local_coordinates) {
    var x = this.x;
    var y = this.y;
    var w = this.width / 2;
    var h = this.height / 2;
    if (local_coordinates) return [-w, -h, w*2, h*2];
    else return [x-w, y-h, w*2, h*2];
  }

  on_collision(obj) {
    /*
      Default GameObjects do nothing on collision. Child classes can use this
      for example to damage or give powerups to tanks on collision.
    */
  }

  update() {
    if (this.physics) {
      // Move by velocity
    }
    if (this.movable) {
      var collisions = GetCollisions(this);
      var prev_x = this.x;
      var prev_y = this.y;
      var done = false;
      while(done === false) {
        done = true;
        for (i = 0; i < collisions.length; i++) {
          var collision = collisions[i];
          var key = collision["direction"];
          if (key == "up" || key == "down") {
            this.y -= collision[key];
          }
          else if (key == "left" || key == "right") {
            this.x -= collision[key];
          }
          var new_collisions = GetCollisions(this);
          if (new_collisions.length === 0) {
            break;
          }
          else if (i < collisions.length-1) {
            this.x = prev_x;
            this.y = prev_y;
          }
          else {
            collisions = new_collisions;
            done = false;
          }
        }
      }
      if (this.physics) {
        // Move away from collisions and invert velocity (i.e. bounce)
      }
      else {
        // Move away from collisions
      }
    }
  }

  draw() {
    ctx.save();
    ctx.fillStyle = this.color;
    ctx.translate(this.x, this.y);
    ctx.rotate(-this.rotation * (Math.PI/180));
    ctx.fillRect.apply(ctx, this.get_rect(true));
    ctx.restore();
  }
};

class Tank extends GameObject {

  constructor(x, y) {
    super(x, y, TANK_SIZE, TANK_SIZE, true, false); // Movable=true, physics=false
    this.speed = 1;
    this.turn_speed = 5;
  }

  update() {
    var radians = this.rotation * (Math.PI/180);
    if (keystate[UpArrow]) {
      this.x -= this.speed * Math.sin(radians);
      this.y -= this.speed * Math.cos(radians);
    }
    else if (keystate[DownArrow]) {
      this.x += this.speed * Math.sin(radians);
      this.y += this.speed * Math.cos(radians);
    }
    if (keystate[LeftArrow]) {
      this.rotation += this.turn_speed;
      if (this.rotation >= 360) this.rotation -= 360;
    }
    else if (keystate[RightArrow]) {
      this.rotation -= this.turn_speed;
      if (this.rotation < 0) this.rotation += 360;
    }

    super.update(); // Checks collisions
    //console.log(this.x);
  }

  draw() {
    var x = this.x;
    var y = this.y;
    var s = this.width/2;
    ctx.save();
    ctx.fillStyle = this.color;
    ctx.translate(x, y);
    ctx.rotate(-this.rotation * (Math.PI/180));
    ctx.fillRect(-s, -s, s*2, s*2); // Draw tank body
    ctx.fillRect(-s/2, -s*2, s, s*2); // Draw gun
    ctx.restore();
  }

};


class Cell {
  constructor(x, y, i, j) {
    this.ind_x = i;
    this.ind_y = j;
    this.x = x;
    this.y = y;
    this.right_wall = true;
    this.bottom_wall = true;
  }
};

function RectRectIntersect(rect1, rect2) {
  /*
    Used for checking collisions between two rectangles.
  */
  ax = rect1[0];
  ay = rect1[1];
  aw = rect1[2];
  ah = rect1[3];
  bx = rect2[0];
  by = rect2[1];
  bw = rect2[2];
  bh = rect2[3];
  var axIntersect = ax < (bx + bw);
  var bxIntersect = bx < (ax + aw);
  var ayIntersect = ay < (by + bh);
  var byIntersect = by < (ay + ah);
  var collision = {};
  //console.log(ax);
  if (axIntersect && bxIntersect && ayIntersect && byIntersect) {
    // Collision detected, calculate intersecting distances from all
    // directions.

    collision["up"] = ay - (by+bh); // How much the rect intersects from below
    collision["down"] = ay+ah - by; // How much the rect intersects from above
    collision["left"] = ax+aw - bx; // ... from left
    collision["right"] = ax - (bx+bw); // ... from right
    var min = collision["up"];
    var min_key = "up";
    for (direction in collision) {
      var value = collision[direction];
      if (Math.abs(value) < Math.abs(min)) {
        min = value;
        min_key = direction;
      }

    }
    collision["direction"] = min_key;
    collision["collision"] = true;
  }
  else {
    collision["collision"] = false;
  }
  return collision;
}

function GetCollisions(obj) {
  /*
    Checks collisions given gameobject and all other gameobjects.
  */
  var collisions = [];
  for (obj_ind in game_objects) {
    var other_obj = game_objects[obj_ind];
    if (obj != other_obj) { // Don't check collision with itself
      var collision = RectRectIntersect(obj.get_rect(false), other_obj.get_rect(false));
      if (collision["collision"] === true) collisions.push(collision);
    }
  }
  return collisions;
}

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

  // Create GameObjects for every wall
  for (column_ind in cells) {
    column = cells[column_ind];
    for (cell_ind in column) {
      cell = column[cell_ind];
      var x = cell.x;
      var y = cell.y;
      var s = cell_size/2;
      var w = wall_width/2;
      if (cell.bottom_wall) {
        var wall = new GameObject(x, y+s, s*2, w*2);
        game_objects.push(wall);
      }
      if (cell.right_wall) {
        var wall = new GameObject(x+s, y, w*2, s*2);
        game_objects.push(wall);
      }
    }
  }
}

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
  game_objects = [];
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

  // Create border walls (top,bottom,left,right)
  game_objects.push(new GameObject(WIDTH/2, wall_width/2, WIDTH, wall_width));
  game_objects.push(new GameObject(WIDTH/2, HEIGHT-wall_width/2, WIDTH, wall_width));
  game_objects.push(new GameObject(wall_width/2, HEIGHT/2, wall_width, HEIGHT));
  game_objects.push(new GameObject(WIDTH - wall_width/2, HEIGHT/2, wall_width, HEIGHT));
  // Generate map
  maze_generator_kruskal();
  // Create tank
  game_objects.push(new Tank(10,10));
}

function update() {
  /*
    Handles game logic by moving all objects and checking collisions.
  */
  for (obj_ind in game_objects) {
    obj = game_objects[obj_ind];
    obj.update();
  }
}

function draw() {
  /*
    Handles all drawing on the HTML5 canvas.
  */
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  for (obj_ind in game_objects) {
    obj = game_objects[obj_ind];
    obj.draw();
  }
}

main();
