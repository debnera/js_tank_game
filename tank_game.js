/*
  Created by: Anton Debner 2016
*/
var TankGame = (function() {
  var WIDTH = 901;
  var HEIGHT = 601;
  var GUI_HEIGHT = 150;
  var DEBUG = false;
  // WASD
  var P1_UP = 87;
  var P1_DOWN = 83;
  var P1_LEFT = 65;
  var P1_RIGHT = 68;
  var P1_FIRE = 49; // Character 1

  // Arrow keys
  var P2_UP = 38;
  var P2_DOWN = 40;
  var P2_LEFT = 37;
  var P2_RIGHT = 39;
  var P2_FIRE = 189; // Character -

  // Other settings
  var TANK_SIZE = 15;
  var TANK_SPEED = 1;
  var TANK_TURN_SPEED = 5;
  var WALL_WIDTH = 2;
  var CELL_SIZE = 50;
  var RESET_COUNTER_MAX = 200; // Time to start next round (frames)
  var EPSILON = 0.001; // Used for comparing floats

  // Optimization: skip collision checks between distant objects
  // NOTE: This only works if there are no large objects in the scene
  var MAX_DIST_FOR_COLLISIONS = 2; // (this is multiplied by CELL_SIZE)

  // Global variables (Do not attempt to configure)
  var TANK_P1, TANK_P2;
  var CELLS_X, CELLS_Y;
  var CANVAS, CTX, KEYSTATE, GAME_OBJECTS;
  var PRERENDERED_CANVAS, PRERENDERED_CTX, PRERENDERED_REDRAW_NEEDED;
  var GUI_REDRAW_NEEDED;
  var END_ROUND = false;
  var RESET_COUNTER;

  var P1 = 1;
  var P2 = 2;
  var P1_SCORE = 0;
  var P2_SCORE = 0;




  /*
  ===============================================================================
  -------------------------------------CLASSES-----------------------------------
  ===============================================================================
  */

  function deg2rad(degrees) {
    return degrees * (Math.PI/180);
  }

  class Vector2d {
    constructor(x, y) {
      if (typeof x == 'undefined' || typeof  y == 'undefined') {
        throw "Invalid arguments";
      }
      this.x = x;
      this.y = y;
    }

    rotate(radians) {
      // Rotates coordinates counterclockwise
      //radians=-radians
      if (radians != 0) {
        var x = this.x;
        var y = this.y;
        this.x = x * Math.cos(radians) - y * Math.sin(radians);
        this.y = x * Math.sin(radians) + y * Math.cos(radians);
      }
      return this;
    }

    add(vector) {
      if (vector instanceof Vector2d) {
        this.x += vector.x;
        this.y += vector.y;
      }
      else throw "Invalid argument";
      return this;
    }

    subtract(vector) {
      if (vector instanceof Vector2d) {
        this.x -= vector.x;
        this.y -= vector.y;
      }
      else throw "Invalid argument";
      return this;
    }

    multiply(value) {
      if (isNaN(value) === false) {
        this.x *= value;
        this.y *= value;
      }
      else throw "Invalid argument";
      return this;
    }

    get_dot_product(other) {
      // Calculates the dot product between given vector
      if (other instanceof Vector2d) return this.x*other.x + this.y*other.y;
      else throw "Invalid argument";
    }

    get_unit_vector() {
      var c = this.get_magnitude();
      var unit_vec = new Vector2d(this.x/c, this.y/c);
      return unit_vec;
    }

    get_right_normal() {
      return new Vector2d(this.y, -this.x);
    }

    get_magnitude() {
      return Math.sqrt(Math.pow(this.x, 2) + Math.pow(this.y, 2));
    }

    get_magnitude_squared() {
      return Math.pow(this.x, 2) + Math.pow(this.y, 2);
    }

    get_inverted() {
      return new Vector2d(-this.x, -this.y);
    }

    clone() {
      return new Vector2d(this.x, this.y);
    }

    reflect(vector) {
      /*
        Reflects this vector around given unit vector.
        vec1 - (2*vec2*(vec2.vec1))
      */
      if (vector instanceof Vector2d) {
        var vec2 = vector.clone(); // Avoid modifying given vector
        vec2.multiply(vec2.get_dot_product(this));
        vec2.multiply(2);
        this.subtract(vec2);
        return this;
      }
      else throw "Invalid argument";
    }
  };

  class GameObject {
    constructor(x, y, width, height, movable = false) {
      this.destructible = true; // Can this object be destroyed?
      this.max_hp = 1000;
      this.hp = this.max_hp;
      this.pos = new Vector2d(x, y);
      this.width = width;
      this.height = height;
      this.rotation = 0; // In degrees
      this.velocity = new Vector2d(0, 0);
      this.movable = movable; // Can be moved by collisions
      this.color = {};
      this.color.r = 0;
      this.color.g = 0;
      this.color.b = 0;
      this.verts = [];
      this.rotated_verts = [];
      this.ignored_collision_objs = [this];
      this.circle = false;
      this.radius = 0;
      this.unstoppable = false; // Lets object move through destructible objects

      var w = this.width / 2;
      var h = this.height / 2;
      this.verts.push(new Vector2d(-w, -h));
      this.verts.push(new Vector2d(-w, h));
      this.verts.push(new Vector2d(w, h));
      this.verts.push(new Vector2d(w, -h));

      GAME_OBJECTS.push(this);
      if (this.movable == false) {
        PRERENDERED_REDRAW_NEEDED = true;
      }

    }

    damage(amount) {
      if (this.destructible && this.hp > 0) {
        if (amount > 0) {
          this.hp -= amount;
          this.color_by_damage();
        }
        else console.log("WARNING: Attempted to damage by negative amount!!!");
      }
    }

    set_unstoppable(value) {
      this.unstoppable = value;
    }

    set_destructible(value) {
      this.destructible = value;
    }

    color_by_damage() {
      var red = Math.round(255 - (255 * (this.hp/this.max_hp)));
      this.color.r = red;
    }

    rotate(degrees) {
      if (degrees != 0) {
        this.rotation += degrees;
        while (this.rotation < 0) this.rotation += 360;
        while (this.rotation > 360) this.rotation -= 360;
        this.calculate_rotated_verts();
      }
    }

    move(vector) {
      if (vector instanceof Vector2d) {
        this.pos.add(vector);
      }
      else throw "Invalid argument";
    }

    get_rect(local_coordinates) {
      var x = this.pos.x;
      var y = this.pos.y;
      var w = this.width / 2;
      var h = this.height / 2;
      if (local_coordinates) return [-w, -h, w*2, h*2];
      else return [x-w, y-h, w*2, h*2];
    }

    calculate_rotated_verts() {
      var radians = deg2rad(this.rotation)
      this.rotated_verts = [];
      for (var vert of this.verts) {
        this.rotated_verts.push(vert.clone().rotate(radians));
      }
      this.rotated_verts;
    }

    get_verts() {
      if (this.rotated_verts.length === 0) this.calculate_rotated_verts();
      return this.rotated_verts;
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
      if (this.movable == false) {
        PRERENDERED_REDRAW_NEEDED = true;
      }
    }

    update() {
      /*
        Moves GameObject by its velocity and checks for collisions.
        If collisions are found, attempts to solve them by moving itself.
      */
      if (this.hp <= 0) {
        this.destroy();
        return;
      }
      if (this.movable) {
        // Move by velocity, if it has any
        this.move(this.velocity);

        // Get all colliding objects
        var collisions = GetCollisions(this);

        var attempts = 0; // Track attempts to prevent infinite loops
        var done = false;
        var max_attempts = 5;
        while(done === false && attempts < max_attempts) {
          var prev_pos = this.pos.clone();
          var prev_velo = this.velocity.clone();
          done = true;
          if (collisions.length > 0) {
            //console.log(collisions);
          }
          for (var i = 0; i < collisions.length; i++) {
            // Loop over all collisions one at a time
            var collision = collisions[i];
            var obj1 = collision.obj1; // This object (redundant)
            var obj2 = collision.obj2; // The colliding object
            var dir = collision.direction.clone();
            if (this.unstoppable && obj2.destructible == true) {
              // Don't attempt to solve collisions for unstoppable objects
              // unstoppable objects can go through almost anything.
              obj1.on_collision(obj2);
              obj2.on_collision(obj1);
              break;
            }
            this.move(dir.clone().multiply(collision.magnitude));
            this.velocity.reflect(dir);


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
              this.pos = prev_pos;
              this.velocity = prev_velo;
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

    draw(context) {
      context.save();
      let color = "rgb(" + this.color.r + "," + this.color.g + "," + this.color.b + ")";
      context.fillStyle = color;
      context.translate(this.pos.x, this.pos.y);
      context.beginPath();
      if (this.circle === true) {
        context.arc(0, 0, this.radius, 0, 2 * Math.PI);
      }
      else {
        var verts = this.get_verts();
        context.moveTo(verts[0].x, verts[0].y);
        for (var vert of verts) {
          context.lineTo(vert.x, vert.y);
        }
        context.lineTo(vert.x, vert.y);
      }
      context.fill();
      context.restore();
    }
  };

  var GunTypes = {
    // Enumeration for different types of guns
    'normal' : 1,
    'machinegun' : 2,
    'heavy' : 3,
  }

  class Gun {
    /*
      Handles the firing of tank guns.
    */
    constructor(tank) {
      this.bullet_size = 5;
      this.bullet_speed = 1.5;
      this.ammo = 1000; // Max shots for current gun
      this.clip = 5; // Max simultaenous shots
      this.fire_delay = 0.5;
      this.last_shot = Date.now();
      this.tank = tank; // Used for ignoring collisions when firing
      this.type = GunTypes.normal;
      this.damage_amount = 4;
      this.randomize_direction = false;
    }

    fire(x, y, direction) {
      var bullet;
      if (this.randomize_direction) {
        direction += Math.random() * 10 - 5; // Add a random offset of +-5 degrees
      }
      if (this.clip > 0 && this.ammo > 0) {
        if (Date.now() - this.last_shot > this.fire_delay * 1000) {
          GUI_REDRAW_NEEDED = true; // GUI has info about remaining ammo
          this.clip--;
          this.ammo--;
          this.last_shot = Date.now();
          bullet = new Bullet(x, y, direction, this.damage_amount, this, this.bullet_size, this.bullet_speed);
        }
      }
      return bullet;
    }

    reload() {
      // Adds one bullet to clip.
      this.clip++;
    }

    get_name() {
      return "40mm gun";
    }

    get_ammo_str() {
      switch (this.type) {
        case GunTypes.normal:
          return "infinite";
          break;
        default:
          return this.ammo;
      }
    }
  };

  class Machinegun extends Gun {
    constructor(tank) {
      super(tank);
      this.bullet_size = 2;
      this.bullet_speed = 2;
      this.ammo = 75;
      this.clip = 15;
      this.fire_delay = 0.1;
      this.damage_amount = 1;
      this.randomize_direction = true;
      this.type = GunTypes.machinegun;
    }

    get_name() {
      return ".50 caliber machine gun";
    }
  };

  class Heavygun extends Gun {
    constructor(tank) {
      super(tank);
      this.bullet_size = 20;
      this.bullet_speed = 1.5;
      this.ammo = 3;
      this.clip = 3;
      this.fire_delay = 1;
      this.damage_amount = 1000;
      this.randomize_direction = false;
      this.type = GunTypes.heavy;
    }

    fire(x, y, direction) {
      // Override firing to make the bullet unstoppable
      var bullet = super.fire(x, y, direction);
      if (bullet)
        bullet.set_unstoppable(true);
    }

    get_name() {
      return "155mm heavy gun";
    }
  };

  class Tank extends GameObject {
    constructor(x, y, player) {
      super(x, y, TANK_SIZE, TANK_SIZE, true); // Movable=true
      this.player = player;
      this.speed = 1;
      this.turn_speed = 5;
      this.fire_delay = 0;
      this.max_fire_delay = 30;
      this.max_ammo = 5;
      this.ammo = this.max_ammo;
      this.max_hp = 10;
      this.hp = this.max_hp;
      this.color_by_damage();

      // Add a gun
      this.set_gun(GunTypes.heavy);
      var w = this.width / 2;
      var h = this.height / 2;
      var last_vert = this.verts.pop();
      this.verts.push(new Vector2d(w, h/2));
      this.verts.push(new Vector2d(w*2, h/2));
      this.verts.push(new Vector2d(w*2, -h/2));
      this.verts.push(new Vector2d(w, -h/2));
      this.verts.push(last_vert);
    }

    set_gun(type) {
      GUI_REDRAW_NEEDED = true; // GUI has info about player weapons
      switch (type) {
        case GunTypes.normal :
          this.gun = new Gun(this);
          break;
        case GunTypes.machinegun :
          this.gun = new Machinegun(this);
          break;
        case GunTypes.heavy :
          this.gun = new Heavygun(this);
          break;
        default :
          console.log("Invalid gun type given " + type);
          this.gun = new Gun(this);
          break;
      }
    }

    destroy() {
      END_ROUND = true;
      this.player === P1 ? P2_SCORE++ : P1_SCORE++;
      for (var i = 0; i < 360; i += 60) {
        // Spawn a ring of bullets on death
        var radians = deg2rad(i);
        var damage = 4;
        var off_x = this.width * Math.cos(radians);
        var off_y = this.width * Math.sin(radians);
        new Bullet(this.pos.x + off_x, this.pos.y + off_y, i, damage);
      }
      super.destroy();
    }

    update() {
      /*
        Checks for user input and checks collisions.
      */
      if (this.fire_delay > 0) this.fire_delay--;
      var p = this.player;
      var radians = deg2rad(this.rotation);

      if ((p == P1 && KEYSTATE[P1_UP]) || (p == P2 && KEYSTATE[P2_UP])) {
        this.velocity.x = this.speed * Math.cos(radians);
        this.velocity.y = this.speed * Math.sin(radians);
      }
      else if ((p == P1 && KEYSTATE[P1_DOWN]) || (p == P2 && KEYSTATE[P2_DOWN])) {
        this.velocity.x = -this.speed * Math.cos(radians);
        this.velocity.y = -this.speed * Math.sin(radians);
      }
      else {
        this.velocity = new Vector2d(0, 0);
      }
      if ((p == P1 && KEYSTATE[P1_LEFT]) || (p == P2 && KEYSTATE[P2_LEFT])) {
        this.rotate(-this.turn_speed);

      }
      else if ((p == P1 && KEYSTATE[P1_RIGHT]) || (p == P2 && KEYSTATE[P2_RIGHT])) {
        this.rotate(this.turn_speed);
      }

      super.update(); // Move and check collisions before firing

      if ((p == P1 && KEYSTATE[P1_FIRE]) || (p == P2 && KEYSTATE[P2_FIRE])) {
        if (this.gun.ammo > 0) {
          var off_x = this.width * 0.9 * Math.cos(radians);
          var off_y = this.width * 0.9 * Math.sin(radians);
          this.gun.fire(this.pos.x + off_x, this.pos.y + off_y, this.rotation);
        }
        else {
          this.set_gun(GunTypes.normal); // Replace all special guns with a regular gun
        }

      }
    }
  };

  var PowerupType = {
    'machinegun' : 1,
    'heavy' : 2,
    'speed' : 3,
    'get_random_type' :
      function get_random_type() {
        return Math.ceil(Math.random() * 3);
      }
  };

  class Powerup extends GameObject {
    constructor(x, y, type) {
      super(x, y, 10, 10, true);
      this.type = type;
      this.max_hp = 20;
      this.hp = this.max_hp;
      this.last_damage_tick = Date.now(); // Cause damage to self every second
      this.turn_speed = 5;
      this.re_color();
    }

    re_color() {
      switch(this.type) {
        case PowerupType.machinegun:
          this.color = {"r":0, "g": 200, "b": 200};
          break;
        case PowerupType.heavy:
          this.color = {"r":0, "g": 50, "b": 120};
          break;
        case PowerupType.speed:
          this.color = {"r":0, "g": 255, "b": 255};
          break;
        default:
          console.log("Powerup has invalid type!");
          this.color = {"r":0, "g": 10, "b": 10};
      }
    }

    update() {
      this.rotate(this.turn_speed);
      if (Date.now() - this.last_damage_tick > 1000) {
        this.last_damage_tick = Date.now();
        this.damage(1); // Max time to live is 20 seconds;
      }
      super.update();
    }

    on_collision(obj) {
      if (obj instanceof Tank) {
        switch (this.type) {
          case PowerupType.machinegun:
            obj.set_gun(GunTypes.machinegun);
            break;
          case PowerupType.heavy:
            obj.set_gun(GunTypes.heavy);
            break;
          case PowerupType.speed:
            obj.speed++;
            break;
          default:
            console.log("Powerup has invalid type!");
        }
        this.destroy();
      }
    }
  };

  class Bullet extends GameObject {
    constructor(x, y, direction, damage, gun, size, speed) {
      if (typeof speed == 'undefined') speed = 1.5;
      if (typeof size == 'undefined') size = 5;
      super(x, y, size, size, true);
      this.max_time_to_live = 15000; // After this time the bullet disappears (milliseconds)
      this.remaining_bounces = 10;
      this.first_bounce = true;
      this.spawn_time = Date.now();
      this.ignore_owner_for = 3 * size / speed; // HACK: this value is just randomly guessed (milliseconds)
      this.speed = speed;
      this.gun = gun;
      if (this.gun && this.gun.tank) this.ignored_collision_objs.push(this.gun.tank); // Don't collide with tank before first bounce
      this.color.r =  Math.round(Math.random() * 255);
      this.color.g =  Math.round(Math.random() * 255);
      this.color.b =  Math.round(Math.random() * 255);
      var radians = deg2rad(direction);
      this.velocity.x = this.speed * Math.cos(radians);
      this.velocity.y = this.speed * Math.sin(radians);
      this.damage_amount = damage;
      this.radius = this.width/2;
      this.circle = true;
    }

    update() {
      super.update();
      if (Date.now() - this.spawn_time > this.max_time_to_live) {
        // This bullet has been around long enough, destroy it
        this.destroy();
      }
    }

    on_collision(obj) {
      this.remaining_bounces--;
      if (this.first_bounce && (Date.now() - this.spawn_time > this.ignore_owner_for) && this.gun && this.gun.tank) {
        // After first bounce bullet can collide with the shooting tank
        this.first_bounce = false;
        var ind = this.ignored_collision_objs.indexOf(this.gun.tank);
        if (ind > -1) delete this.ignored_collision_objs[ind];
      }

      if (this.remaining_bounces < 1) {
        this.destroy();
      }

      obj.damage(this.damage_amount);
      if (obj instanceof Tank) {
        this.destroy();
      }
    }

    destroy() {
      if (this.gun) this.gun.reload();
      super.destroy();
    }

  };




  /*
  ===============================================================================
  ----------------------------COLLISION DETECTION--------------------------------
  ===============================================================================
  */

  class Collision {
    constructor(game_obj1, game_obj2) {
      this.obj1 = game_obj1;
      this.obj2 = game_obj2;
      this.has_collided = false;
      this.direction = new Vector2d(0, 0); // Direction of penetration
      this.magnitude = Number.NEGATIVE_INFINITY; // Shortest distance of penetration
    }
  }

  function getSATCollision(game_obj1, game_obj2) {
    /*
      Uses Separating Axis Test to get the direction and magnitude of
      any possible collision between given two objects.
      https://en.wikipedia.org/wiki/Hyperplane_separation_theorem

      Objects can have any convex shape. Circles are a special case.
    */
    var obj1 = game_obj1;
    var obj2 = game_obj2;
    let temp_pos1 = obj1.pos.clone();
    var d_origins = temp_pos1.subtract(obj2.pos).get_magnitude();
    var collision = new Collision(game_obj1, game_obj2);
    collision.has_collided = false;
    if (d_origins > MAX_DIST_FOR_COLLISIONS * CELL_SIZE) {
      // Optimization: Skip further checks for distant objects
      return collision;
    }
    var verts1 = game_obj1.get_verts();
    var verts2 = game_obj2.get_verts();
    var pos1 = game_obj1.pos.clone();
    var pos2 = game_obj2.pos.clone();

    for (var i = 0; i < verts1.length + verts2.length; i++) {
      // Calculate next axis by taking the normal of a side of one object
      if (i < verts1.length) {
        var vert = verts1[i];
        if (i < verts1.length-1) var next_vert = verts1[i+1];
        else var next_vert = verts1[0];
      }
      else {
        var vert = verts2[i - verts1.length];
        if (i < verts1.length+verts2.length-1) var next_vert = verts2[i+1 - verts1.length];
        else var next_vert = verts2[0];
      }
      var side = next_vert.clone().subtract(vert).get_unit_vector();
      var axis = side.get_right_normal();

      // Get minimum and maximum projections on axis from center of obj1
      var min_dist1 = verts1[0].get_dot_product(axis);
      var max_dist1 = min_dist1;
      for (var j = 1; j < verts1.length; j++) {
        var distance = verts1[j].get_dot_product(axis);
        if (distance < min_dist1) min_dist1 = distance;
        else if (distance > max_dist1) max_dist1 = distance;
      }

      // Get minimum and maximum projections on axis from center of obj2
      var min_dist2 = verts2[0].get_dot_product(axis);
      var max_dist2 = min_dist2;
      for (var j = 1; j < verts2.length; j++) {
        var distance = verts2[j].get_dot_product(axis);
        if (distance < min_dist2) min_dist2 = distance;
        else if (distance > max_dist2) max_dist2 = distance;
      }

      // Calculate the distance between objects and flip axis if necessary
      var d = new Vector2d(pos2.x - pos1.x, pos2.y - pos1.y).get_dot_product(axis);

      // Calculate the gaps between objects projected along axis
      // Negative gap means that there is a collision on this axis
      var gap1 = d - max_dist1 + min_dist2;
      var gap2 = - d - max_dist2 + min_dist1;
      if (gap1 >= -EPSILON || gap2 >= -EPSILON) {
        // No collision on this axis - these objects cannot be colliding!
        collision.has_collided = false;
        return collision;
      }
      if (gap1 > gap2 && gap1 > collision.magnitude) {
        collision.magnitude = gap1;
        collision.direction = axis;
      }
      if (gap2 > gap1 && gap2 > collision.magnitude) {
        collision.magnitude = gap2;
        collision.direction = axis.get_inverted();
      }
    }
    collision.has_collided = true;
    return collision;
  }

  function GetCollisions(obj) {
    /*
      Checks collisions given gameobject and all other gameobjects.
    */
    var ign1 = obj.ignored_collision_objs;
    var collisions = [];
    for (obj_ind in GAME_OBJECTS) {
      var other_obj = GAME_OBJECTS[obj_ind];
      var ign2 = other_obj.ignored_collision_objs;
      if (ign1.indexOf(other_obj) === -1 && ign2.indexOf(obj) === -1) {
        var collision = getSATCollision(obj, other_obj);
        if (collision.has_collided === true) {
          collisions.push(collision);
        }
      }
    }
    return collisions;
  }






  /*
  ===============================================================================
  ---------------------------------MAIN FUNCTIONS--------------------------------
  ===============================================================================
  */

  function main() {
    /*
      Creates a new HTML5 canvas element, adds listeners for input and
      contains the main loop.
    */
    CANVAS = document.createElement("canvas")
    CANVAS.width = WIDTH;
    CANVAS.height = HEIGHT + GUI_HEIGHT;
    CTX = CANVAS.getContext("2d");

    // Initialize another canvas for quickly drawing static objects
    PRERENDERED_CANVAS = document.createElement("canvas")
    PRERENDERED_CANVAS.width = WIDTH;
    PRERENDERED_CANVAS.height = HEIGHT + GUI_HEIGHT;
    PRERENDERED_CTX = PRERENDERED_CANVAS.getContext("2d");

    // Attempt to find a document element with specific id, otherwise attach the
    // canvas to document body.
    attach_to = document.getElementById('game_window');
    if (attach_to == null) attach_to = document.body;
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
    RESET_COUNTER = 0;

    var previous_time = Date.now(); // Time in milliseconds
    var frames = 0;
    var iteration_time = 0;

    var loop = function() {
      /*
        The main loop where all the magic happens.
      */
      var start_time = Date.now();
      // Step the game forwards and draw everything
      spawn_powerup();
      update();
      draw();
      iteration_time += Date.now() - start_time;

      // FPS-counter for performance analysis
      if (DEBUG) {
        frames++;
        if (Date.now() - previous_time > 1000) {
          console.log(frames + "  :  " + (iteration_time/frames));
          previous_time = Date.now();
          iteration_time = 0;
          frames = 0;
        }
      }


      // Start a new round if necessary
      if (END_ROUND === true) RESET_COUNTER++;
      if (RESET_COUNTER > RESET_COUNTER_MAX) {
        init();
        END_ROUND = false;
        RESET_COUNTER = 0;
      }

      // Wait for the browser to finish drawing before looping again
      window.requestAnimationFrame(loop, CANVAS);
    };
    window.requestAnimationFrame(loop, CANVAS);
  }

  function spawn_powerup() {
    // Randomly spawns a random powerup to the level
    this.max_spawn_time = 50000; // Max time between spawns (Milliseconds)
    if (typeof this.last_spawn == 'undefined') {
      this.last_spawn = Date.now();
      this.next_spawn_in = Math.random() * this.max_spawn_time;
    }
    if (Date.now() - this.last_spawn > this.next_spawn_in) {
      this.last_spawn = Date.now();
      this.next_spawn_in = Math.random() * this.max_spawn_time;
      let pos = get_random_location();
      new Powerup(pos.x, pos.y, PowerupType.get_random_type());
    }
  }

  function get_random_location() {
    // Gets a location, which is in the middle of a random cell.
    var x = (Math.floor(Math.random() * CELLS_X) + 0.5) * (CELL_SIZE);
    var y = (Math.floor(Math.random() * CELLS_Y) + 0.5) * (CELL_SIZE);
    return new Vector2d(x, y);
  }

  function init() {
    /*
      Initialize global variables.
    */
    GAME_OBJECTS = [];
    KEYSTATE = {}; // Reset the keystate to avoid stuck buttons
    PRERENDERED_REDRAW_NEEDED = true;
    GUI_REDRAW_NEEDED = true;



    // Generate map
    maze_generator_kruskal();

    // Create tanks at random locations

    let pos = get_random_location();
    TANK_P1 = new Tank(pos.x, pos.y, P1);
    let pos2 = pos;
    while (pos.x == pos2.x && pos.y == pos2.y) {
      pos2 = get_random_location();
    }
    TANK_P2 = new Tank(pos2.x, pos2.y, P2);
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

    // Game
    CTX.fillStyle = "#fff";
    CTX.clearRect(0, 0, WIDTH, HEIGHT);

    // Redraw static objects only if they have been changed
    if (PRERENDERED_REDRAW_NEEDED) {
      PRERENDERED_CTX.fillStyle = "#fff";
      PRERENDERED_CTX.clearRect(0, 0, WIDTH, HEIGHT);
      PRERENDERED_REDRAW_NEEDED = false;
      for (obj_ind in GAME_OBJECTS) {
        obj = GAME_OBJECTS[obj_ind];
        if (obj.movable === false) {
          obj.draw(PRERENDERED_CTX);
        }
      }
    }

    // Draw prerendered static objects
    CTX.drawImage(PRERENDERED_CANVAS, 0, 0);

    // Draw other objects
    for (obj_ind in GAME_OBJECTS) {
      obj = GAME_OBJECTS[obj_ind];
      if (obj.movable === true) {
        obj.draw(CTX);
      }
    }

    // GUI
    if (GUI_REDRAW_NEEDED || END_ROUND) {
      GUI_REDRAW_NEEDED = false;
      var P2_offset_x = WIDTH - 250;
      CTX.save();
      CTX.translate(0, HEIGHT); // Move to GUI space
      CTX.fillStyle = "#fff";
      CTX.clearRect(0, 0, WIDTH, GUI_HEIGHT);
      CTX.font = "30px Arial";
      CTX.fillStyle = (P1_SCORE >= P2_SCORE) ? "green" : "red";
      CTX.fillText("Player One: " + P1_SCORE, 30, 50);
      CTX.fillStyle = (P2_SCORE >= P1_SCORE) ? "green" : "red";
      CTX.fillText("Player Two: " + P2_SCORE, P2_offset_x, 50);
      if (END_ROUND === true) {
        CTX.fillStyle = "blue";
        CTX.fillText("Next round in: " + (RESET_COUNTER_MAX - RESET_COUNTER), P2_offset_x/2, 50);
      }
      CTX.fillStyle = "#000";
      CTX.font = "16px Arial";
      CTX.fillText("Move: WASD", 30, 80);
      CTX.fillText("Fire: 1", 30, 100);
      CTX.fillText("Weapon: " + TANK_P1.gun.get_name(), 30, 120);
      CTX.fillText("Ammo remaining: " + TANK_P1.gun.get_ammo_str(), 30, 140);
      CTX.fillText("Move: Arrow keys", P2_offset_x, 80);
      CTX.fillText("Fire: -", P2_offset_x, 100);
      CTX.fillText("Weapon: " + TANK_P2.gun.get_name(), P2_offset_x, 120);
      CTX.fillText("Ammo remaining: " + TANK_P2.gun.get_ammo_str(), P2_offset_x, 140);
      CTX.restore();
    }
  }





  /*
  ===============================================================================
  ---------------------------------MAP GENERATION--------------------------------
  ===============================================================================
  */

  function maze_generator_kruskal() {
    /*
      Uses randomized Kruskal's algorithm to generate a maze.
      https://en.wikipedia.org/wiki/Maze_generation_algorithm#Randomized_Kruskal.27s_algorithm

      Normally this algorithm generates 'perfect' mazes, with only one route
      from end to beginning. For gameplay reasons multiple routes through the
      maze is preferred. This is achieved by randomly deleting additional walls.
    */

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

    function shuffle(a) {
      /*
        Shuffles array in place.
        Taken from http://stackoverflow.com/questions/6274339/how-can-i-shuffle-an-array-in-javascript
        because I'm lazy and it is a perfectly fine function.
      */
      var j, x, i;
      for (var i = a.length; i; i--) {
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
    cell_size_min = 30;
    cell_size_max = 100;
    rand = Math.random();
    CELL_SIZE = 30 + (rand * (100-30)); // A random number between min and max
    CELL_SIZE = Math.floor(CELL_SIZE);
    console.log(CELL_SIZE);
    console.log(CELL_SIZE % 5);
    CELL_SIZE -= CELL_SIZE % 5;
    console.log(CELL_SIZE);

    // Create cells to assist with maze generation
    var cells = [];
    CELLS_X = Math.floor(WIDTH / CELL_SIZE);
    CELLS_Y = Math.floor(HEIGHT / CELL_SIZE);
    for (var i = 0; i < CELLS_X; i++) {
      var x = i * CELL_SIZE + CELL_SIZE / 2;
      var column = []

      for (var j = 0; j < CELLS_Y; j++) {
        var y = j * CELL_SIZE + CELL_SIZE / 2;
        new_cell = new Cell(x, y, i, j);
        column[j] = new_cell;
      }
      cells[i] = column;
    }

    // Add all walls to arrays and create a set for each cell
    var right_walls = [];
    var bottom_walls = [];
    var cell_sets = [];
    for (var i = 0; i < CELLS_X; i++) {
      for (var j = 0; j < CELLS_Y; j++) {
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
    var vert_prob = 0.7; // value must be 0 < x <= 1
    var remove_anyway_prob = 0.2; // Probability for removing extra walls

    // Remove all walls between disconnected cells
    while (right_walls.length > 0 && bottom_walls.length > 0) {
      // Right walls
      if (right_walls.length > 0 && Math.random() < vert_prob) {
        var cell = right_walls.pop();
        if (cell.ind_x + 1 < CELLS_X) {
          next_cell = cells[cell.ind_x+1][cell.ind_y];
          // Check if the cell on right belongs to the same set (already connected)
          if (join_cell_sets(cell, next_cell, cell_sets)) {
            cell.right_wall = false;
          }
          // Randomly delete the wall anyway
          else if (Math.random() < remove_anyway_prob) cell.right_wall = false;
        }
      }

      // Bottom walls
      if (bottom_walls.length > 0 && Math.random() < horiz_prob) {
        var cell = bottom_walls.pop();
        if (cell.ind_y + 1 < CELLS_Y) {
          next_cell = cells[cell.ind_x][cell.ind_y+1];
          // Check if the cell below belongs to the same set (already connected)
          if (join_cell_sets(cell, next_cell, cell_sets)) {
            cell.bottom_wall = false;
          }
          // Randomly delete the wall anyway
          else if (Math.random() < remove_anyway_prob) cell.bottom_wall = false;
        }
      }
    }

    // Create a GameObject for every wall
    for (column_ind in cells) {
      column = cells[column_ind];
      for (cell_ind in column) {
        cell = column[cell_ind];
        var x = cell.x;
        var y = cell.y;
        var s = CELL_SIZE/2;
        var w = WALL_WIDTH/2;
        if (cell.bottom_wall) {
          let wall = new GameObject(x, y+s, s*2, w*2);
          if (cell_ind == column.length-1) {
            // Make the border walls indestructible
            wall.set_destructible(false);
          }
        }
        if (cell.right_wall) {
          let wall = new GameObject(x+s, y, w*2, s*2);
          if (column_ind == cells.length-1) {
            // Make the border walls indestructible
            wall.set_destructible(false);
          }
        }

        // Add left border wall
        if (column_ind == 0) {
          let wall = new GameObject(x-s+1, y, w*2, s*2);
          // Make the border walls indestructible
          wall.set_destructible(false);
        }
        if (cell_ind == 0) {
          let wall = new GameObject(x, y-s+1, s*2, w*2);
          // Make the border walls indestructible
          wall.set_destructible(false);
        }
      }
    }
  }

  main();

  return {
    // Return some objects/methods for debugging purposes
    GAME_OBJECTS : GAME_OBJECTS,
    SET_DEBUG : function set_debug(value) { DEBUG = value; },
    SET_COLLISION_DISTANCE : function set_collision_distance(value) { MAX_DIST_FOR_COLLISIONS = value; },
  };

})();
