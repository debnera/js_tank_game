/*
  Created by: Anton Debner 2016
*/

var WIDTH=900, HEIGHT=600;
// Arrow keys, fire: '
var P1_UP=38, P1_DOWN=40, P1_LEFT=37, P1_RIGHT=39, P1_FIRE=191;
// WASD, fire: 1
var P2_UP=87, P2_DOWN=83, P2_LEFT=65, P2_RIGHT=68, P2_FIRE=49;
var P1 = 1;
var P2 = 2;
var CANVAS, CTX, KEYSTATE;
var CELLS, GAME_OBJECTS;
var TANK_SIZE = 15;
var TANK_SPEED = 1;
var TANK_TURN_SPEED = 5;
var WALL_WIDTH = 2;
var CELL_SIZE = 50;
var NUM_CELLS_X, NUM_CELLS_Y; // Assigned when cells are created
var END_ROUND = false;


class GameObject {
  constructor(x, y, width, height, movable = false, physics = false) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.rotation = 0;
    this.velocity = new Object();
    this.velocity.x = 0;
    this.velocity.y = 0;
    this.movable = movable; // Can be moved by collisions
    this.physics = physics;
    this.color = "#000";
    GAME_OBJECTS.push(this);
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
    //console.log(typeof(obj));
  }

  destroy() {
    var i = GAME_OBJECTS.indexOf(this);
    delete GAME_OBJECTS[i];
  }

  update() {
    /*
      Moves GameObject by its velocity and checks for collisions.
      If collisions are found, attempts to solve them by moving itself.
    */
    if (this.movable) {
      // Move by velocity, if it has any
      this.x += this.velocity.x;
      this.y += this.velocity.y;

      // Get all colliding objects
      var collisions = GetCollisions(this);

      var attempts = 0; // Track attempts to prevent infinite loops
      var done = false;
      var max_attempts = 5;
      while(done === false && attempts < max_attempts) {
        var prev_x = this.x;
        var prev_y = this.y;
        var prev_velo_x = this.velocity.x;
        var prev_velo_y = this.velocity.y;
        done = true;
        for (i = 0; i < collisions.length; i++) {
          // Loop over all collisions one at a time
          var collision = collisions[i];
          var obj1 = collision["obj1"]; // This object (redundant)
          var obj2 = collision["obj2"]; // The colliding object
          var key = collision["direction"];

          // Move this object the minimum distance required to solve collision
          if (key == "up" || key == "down") {
            this.y -= collision[key];
            this.velocity.y = -this.velocity.y; // 'Bounce' off the object by switching direction
          }
          else if (key == "left" || key == "right") {
            this.x -= collision[key];
            this.velocity.x = -this.velocity.x; // 'Bounce' off the object by switching direction
          }

          // Get all new collisions after moving
          var new_collisions = GetCollisions(this);
          if (new_collisions.length === 0) {
            // Success! No new collisions found
            obj1.on_collision(obj2);
            obj2.on_collision(obj1);
            break; // Don't check any other collisions
          }
          else if (i < collisions.length-1) {
            // Fail! Move back to original position and attempt to solve the next collision
            this.x = prev_x;
            this.y = prev_y;
            this.velocity.x = prev_velo_x;
            this.velocity.y = prev_velo_y;
          }
          else {
            // Fail! No collisions remaining. Try to resolve collisions from the new position
            obj1.on_collision(obj2);
            obj2.on_collision(obj1);
            collisions = new_collisions;
            done = false;
            attempts++;
          }
        }
      }
      if(attempts > 1) {
        console.log("Attempted to resolve collisions " + attempts + " times");
      }
    }
  }

  draw() {
    CTX.save();
    CTX.fillStyle = this.color;
    CTX.translate(this.x, this.y);
    CTX.rotate(-this.rotation * (Math.PI/180));
    CTX.fillRect.apply(CTX, this.get_rect(true));
    CTX.restore();
  }
};


class Tank extends GameObject {
  constructor(x, y, player) {
    super(x, y, TANK_SIZE, TANK_SIZE, true, false); // Movable=true, physics=false
    this.player = player;
    this.speed = 1;
    this.turn_speed = 5;
    this.fire_delay = 0;
    this.max_fire_delay = 30;
    this.max_ammo = 5;
    this.ammo = this.max_ammo;
    this.max_hp = 10;
    this.hp = this.max_hp;
  }

  damage(amount) {
    if (amount > 0) this.hp -= amount;
    else console.log("WARNING: Attempted to damage by negative amount!!!");
    if (this.hp < 0) this.destroy();
  }

  destroy() {
    END_ROUND = true;
    for (i = 0; i < 360; i += 60) {
      // Spawn a ring of bullets on death
      var radians = i * (Math.PI/180);
      var off_x = -this.width * 1.1 * Math.sin(radians);
      var off_y = -this.width * 1.1 * Math.cos(radians);
      new Bullet(this.x + off_x, this.y + off_y, i, this);
    }
    super.destroy();
  }

  update() {
    /*
      Checks for user input and checks collisions.
    */
    if (this.fire_delay > 0) this.fire_delay--;
    var p = this.player;
    var radians = this.rotation * (Math.PI/180);
    if ((p == P1 && KEYSTATE[P1_UP]) || (p == P2 && KEYSTATE[P2_UP])) {
      this.x -= this.speed * Math.sin(radians);
      this.y -= this.speed * Math.cos(radians);
    }
    else if ((p == P1 && KEYSTATE[P1_DOWN]) || (p == P2 && KEYSTATE[P2_DOWN])) {
      this.x += this.speed * Math.sin(radians);
      this.y += this.speed * Math.cos(radians);
    }
    if ((p == P1 && KEYSTATE[P1_LEFT]) || (p == P2 && KEYSTATE[P2_LEFT])) {
      this.rotation += this.turn_speed;
      if (this.rotation >= 360) this.rotation -= 360;
    }
    else if ((p == P1 && KEYSTATE[P1_RIGHT]) || (p == P2 && KEYSTATE[P2_RIGHT])) {
      this.rotation -= this.turn_speed;
      if (this.rotation < 0) this.rotation += 360;
    }
    if ((p == P1 && KEYSTATE[P1_FIRE]) || (p == P2 && KEYSTATE[P2_FIRE])) {
      //p === P1 ? delete KEYSTATE[P1_FIRE] : delete KEYSTATE[P2_FIRE];
      if (this.fire_delay === 0 && this.ammo > 0) {
        this.ammo--;
        this.fire_delay = this.max_fire_delay;
        var off_x = -this.width * 1.1 * Math.sin(radians);
        var off_y = -this.width * 1.1 * Math.cos(radians);
        new Bullet(this.x + off_x, this.y + off_y, this.rotation, this);
      }

    }
    super.update(); // Checks collisions
  }

  draw() {
    var x = this.x;
    var y = this.y;
    var s = this.width/2;
    CTX.save();
    var red = Math.round(255 - (255 * (this.hp/this.max_hp)));
    CTX.fillStyle = "rgb(" + red + ",0,0)";
    CTX.translate(x, y);
    CTX.rotate(-this.rotation * (Math.PI/180));
    CTX.fillRect(-s, -s, s*2, s*2); // Draw tank body
    CTX.fillRect(-s/2, -s*2, s, s*2); // Draw gun
    CTX.restore();
  }
};


class Bullet extends GameObject {
  constructor(x, y, direction, owner_tank) {
    super(x, y, 5, 5, true, true);
    this.remaining_bounces = 10;
    this.speed = 1.5;
    this.tank = owner_tank;
    this.color = "rgb(" +
      Math.round(Math.random() * 255) + "," +
      Math.round(Math.random() * 255) + "," +
      Math.round(Math.random() * 255) + ")";
    var radians = direction * (Math.PI/180);
    this.velocity.x = -this.speed * Math.sin(radians);
    this.velocity.y = -this.speed * Math.cos(radians);
    this.damage = 4;
  }

  on_collision(obj) {
    this.remaining_bounces--;
    if (this.remaining_bounces < 1) {
      this.destroy();
    }
    if (obj instanceof Tank) {
      obj.damage(this.damage);
      this.destroy();
    }
  }

  destroy() {
    if (this.tank) this.tank.ammo++;
    super.destroy();
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
  for (obj_ind in GAME_OBJECTS) {
    var other_obj = GAME_OBJECTS[obj_ind];
    if (obj != other_obj) { // Don't check collision with itself
      var collision = RectRectIntersect(obj.get_rect(false), other_obj.get_rect(false));
      if (collision["collision"] === true) {
        collision["obj1"] = obj;
        collision["obj2"] = other_obj;
        collisions.push(collision);
      }
    }
  }
  return collisions;
}

function get_cell_neighbours(x, y) {
  var neighbours = [];
  for (x2 = x - 1; x2 < x + 1; x2++) {
    for (y2 = y - 1; y2 < y + 1; y2++) {
      if (x2 >= 0 && x2 < NUM_CELLS_X && y2 >= 0 && y2 < NUM_CELLS_Y) {
        neighbours.push(CELLS[x2][y2]);
      }
    }
  }
  return neighbours;
}

function main() {
  /*
    Creates a new HTML5 canvas element, adds listeners for input and
    contains the main loop.
  */
  CANVAS = document.createElement("canvas")
  CANVAS.width = WIDTH;
  CANVAS.height = HEIGHT;
  CTX = CANVAS.getContext("2d");

  // Attempt to find a document element with specific id, otherwise attach the
  // canvas to document body.
  attach_to = document.getElementById('game_window');
  if (attach_to == null)
  {
      attach_to = document.body;
  }
  attach_to.appendChild(CANVAS);

  // Add listeners for keydown and keyup
  KEYSTATE = {};
  document.addEventListener("keydown", function(evt) {
    //if (evt.keyCode === UpArrow || evt.keyCode === DownArrow) {
      // Prevent up and down arrows from scrolling the website
      //evt.preventDefault();
    //}
    KEYSTATE[evt.keyCode] = true;
  });

  document.addEventListener("keyup", function(evt) {
    delete KEYSTATE[evt.keyCode];
  });



  init();
  var reset_counter = 0;
  var reset_counter_max = 200;
  var previous_time = Date.now(); // Time in milliseconds
  var frames = 0;
  var loop = function() {
    /*
      The main loop where all the magic happens.
    */
    frames++;
    if (Date.now() - previous_time > 1000) {
      console.log(frames);
      previous_time = Date.now();
      frames = 0;
    }
    update();
    draw();

    if (END_ROUND === true) reset_counter++;
    if (reset_counter < reset_counter_max && reset_counter > 0
        && reset_counter % 10 === 0) {
      console.log("Ending round in " + (reset_counter_max - reset_counter));
    }
    if (reset_counter > reset_counter_max) {
      // Round has ended and a reasonable time has passed - Reset the game
      init();
      END_ROUND = false;
      reset_counter = 0;
    }
    window.requestAnimationFrame(loop, CANVAS);
  };
  window.requestAnimationFrame(loop, CANVAS);
}

function init() {
  /*
    Sets gameobjects to their starting values.
  */
  GAME_OBJECTS = [];
  KEYSTATE = {}; // Reset the keystate to avoid stuck buttons
  CELLS = [];
  NUM_CELLS_X = Math.round(WIDTH / CELL_SIZE);
  NUM_CELLS_Y = Math.round(HEIGHT / CELL_SIZE);
  for (i = 0; i < NUM_CELLS_X; i++) {
    var x = i * CELL_SIZE + CELL_SIZE / 2;
    var column = []

    for (j = 0; j < NUM_CELLS_Y; j++) {
      var y = j * CELL_SIZE + CELL_SIZE / 2;
      new_cell = new Cell(x, y, i, j);
      column[j] = new_cell;
    }
    CELLS[i] = column;
  }

  // Create border walls (top,bottom,left,right)
  new GameObject(WIDTH/2, WALL_WIDTH/2, WIDTH, WALL_WIDTH);
  new GameObject(WIDTH/2, HEIGHT-WALL_WIDTH/2, WIDTH, WALL_WIDTH);
  new GameObject(WALL_WIDTH/2, HEIGHT/2, WALL_WIDTH, HEIGHT);
  new GameObject(WIDTH - WALL_WIDTH/2, HEIGHT/2, WALL_WIDTH, HEIGHT);

  // Generate map
  maze_generator_kruskal();

  // Create tanks
  new Tank(25, 25, P1);
  new Tank(525, 525, P2);
}

function update() {
  /*
    Handles game logic by moving all objects and checking collisions.
  */
  for (obj_ind in GAME_OBJECTS) {
    obj = GAME_OBJECTS[obj_ind];
    obj.update();
  }
}

function draw() {
  /*
    Handles all drawing on the HTML5 canvas.
  */
  CTX.fillStyle = "#fff";
  CTX.fillRect(0, 0, WIDTH, HEIGHT);
  for (obj_ind in GAME_OBJECTS) {
    obj = GAME_OBJECTS[obj_ind];
    obj.draw();
  }
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
  for (i = 0; i < NUM_CELLS_X; i++) {
    for (j = 0; j < NUM_CELLS_Y; j++) {
      cell = CELLS[i][j];
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
      if (cell.ind_x + 1 < NUM_CELLS_X) {
        next_cell = CELLS[cell.ind_x+1][cell.ind_y];
        if (join_cell_sets(cell, next_cell, cell_sets)) {
          cell.right_wall = false;
        }
        // Randomly delete the wall anyway
        else if (Math.random() < remove_anyway_prob) cell.right_wall = false;
      }
    }
    if (bottom_walls.length > 0 && Math.random() < horiz_prob) {
      var cell = bottom_walls.pop();
      if (cell.ind_y + 1 < NUM_CELLS_Y) {
        next_cell = CELLS[cell.ind_x][cell.ind_y+1];
        if (join_cell_sets(cell, next_cell, cell_sets)) {
          cell.bottom_wall = false;
        }
        // Randomly delete the wall anyway
        else if (Math.random() < remove_anyway_prob) cell.bottom_wall = false;
      }
    }
  }

  // Create GameObjects for every wall
  for (column_ind in CELLS) {
    column = CELLS[column_ind];
    for (cell_ind in column) {
      cell = column[cell_ind];
      var x = cell.x;
      var y = cell.y;
      var s = CELL_SIZE/2;
      var w = WALL_WIDTH/2;
      if (cell.bottom_wall) {
        new GameObject(x, y+s, s*2, w*2);
      }
      if (cell.right_wall) {
        new GameObject(x+s, y, w*2, s*2);
      }
    }
  }
}

main();
