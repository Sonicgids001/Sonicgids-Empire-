/* ==========================================================================
   SONICGIDS EMPIRE — ARCADE CATALOGUE (seed data)
   --------------------------------------------------------------------------
   Games are licensed for free embedding by GameMonetize
   (https://gamemonetize.com). They run from GameMonetize's own servers in an
   iframe — nothing is downloaded or hosted here.

   This file ships with a starter set so the arcade works offline and on day
   one. To pull the live catalogue (hundreds of games, refreshed weekly), run:

       node tools/fetch-gamemonetize.js

   ...then commit the regenerated assets/data/games.js.

   Shape of a record:
     id            GameMonetize game id (used in play.html?id=…)
     slug          URL-friendly title
     title         Display name
     category      GameMonetize primary category
     tags          Short tag list (search + chips)
     description   One or two sentence blurb
     instructions  Controls / how to play
     url           iframe source on html5.gamemonetize.co
     thumb         512×384 cover image on img.gamemonetize.com
     width,height  Native aspect ratio (used to size the player stage)
   ========================================================================== */

window.SG_GAMES_SEED = {
  source: "https://gamemonetize.com",
  updated: "2026-11-01",
  games: [
    {
      id: "86769",
      slug: "fps-block-strike-dust2",
      title: "FPS Block Strike Dust2",
      category: "Multiplayer",
      tags: ["3D", "Shooter", "War", "Multiplayer"],
      description:
        "Team-based block-style FPS. Pick Terrorists or Counter-Terrorists, buy your weapon at the market and fight for the Dust2-style arena with your squad.",
      instructions:
        "WASD or arrow keys to move, mouse to aim and shoot, B opens the market, E plants the bomb.",
      url: "https://html5.gamemonetize.co/09injp4gn3ewindof0o3jf5jrx6apcij/",
      thumb: "https://img.gamemonetize.com/09injp4gn3ewindof0o3jf5jrx6apcij/512x384.jpg",
      width: 800,
      height: 600
    },
    {
      id: "87967",
      slug: "rim-rebels-3v3",
      title: "Rim Rebels 3v3",
      category: "Sports",
      tags: ["3D", "Basketball", "Multiplayer", "Online"],
      description:
        "Full-court street basketball with four short quarters. Hang in the air for jumpers, throw alley-oops, swat shots and take it online in Quick Match.",
      instructions:
        "WASD/arrows to move, J or Space to shoot (hold to hang), K to pass, Shift for turbo, E to switch players.",
      url: "https://html5.gamemonetize.co/ezj7t4c7bsypp7g0gkrjcmmz6wfyoue0/",
      thumb: "https://img.gamemonetize.com/ezj7t4c7bsypp7g0gkrjcmmz6wfyoue0/512x384.jpg",
      width: 1280,
      height: 720
    },
    {
      id: "90307",
      slug: "blocktrail-2048",
      title: "Blocktrail 2048",
      category: "Arcade",
      tags: ["2048", "Survival", "Hypercasual", "Collecting"],
      description:
        "Run a colourful blocky arena, grow your number trail and chase down weaker rivals to steal their points. Grab power-ups and hunt the moving Golden Cube.",
      instructions: "Move with WASD, the arrow keys or the mouse. Space for a boost.",
      url: "https://html5.gamemonetize.co/rnl5036gss1kmira1m8fow1twkorw3eb/",
      thumb: "https://img.gamemonetize.com/rnl5036gss1kmira1m8fow1twkorw3eb/512x384.jpg",
      width: 1280,
      height: 720
    },
    {
      id: "86966",
      slug: "ocean-dash",
      title: "Ocean Dash",
      category: "Hypercasual",
      tags: ["Animal", "Collecting", "Classic"],
      description:
        "Dive into the deep, catch rare fish and bank the rewards. Use power-ups, keep clear of sharks and watch each mission get faster.",
      instructions: "WASD to swim.",
      url: "https://html5.gamemonetize.co/arvyl12trgul0tfrumhsdt9u1gdoo98k/",
      thumb: "https://img.gamemonetize.com/arvyl12trgul0tfrumhsdt9u1gdoo98k/512x384.jpg",
      width: 1920,
      height: 1080
    },
    {
      id: "87008",
      slug: "fruit-box-sort",
      title: "Fruit Box Sort",
      category: "Puzzle",
      tags: ["Sorting", "Logic", "Casual", "Mobile"],
      description:
        "Tap open boxes, send fruit onto the conveyor belt and fill the matching containers across 210 levels of mystery boxes, barrels, ice and linked crates.",
      instructions:
        "Left-click or tap boxes and buttons, match fruit with the containers and keep space on the belt.",
      url: "https://html5.gamemonetize.co/au6crdudkwzdpwt0w1jbis0po9k6v9b8/",
      thumb: "https://img.gamemonetize.com/au6crdudkwzdpwt0w1jbis0po9k6v9b8/512x384.jpg",
      width: 750,
      height: 1334
    },
    {
      id: "87476",
      slug: "goods-sort-match-puzzle",
      title: "Goods Sort Match Puzzle",
      category: "Puzzle",
      tags: ["Match 3", "Sorting", "Brain"],
      description:
        "Drag drinks, snacks and toys between shelves, line up three identical goods to clear them and keep the board moving before the timer runs out.",
      instructions:
        "Click and hold an item, drag it to an empty slot and release. Match three on the same shelf to clear them.",
      url: "https://html5.gamemonetize.co/fzoo4gkhywbbwonj32tu14f50gjpt2un/",
      thumb: "https://img.gamemonetize.com/fzoo4gkhywbbwonj32tu14f50gjpt2un/512x384.jpg",
      width: 1280,
      height: 720
    },
    {
      id: "87577",
      slug: "castle-crashers-stolen-sun",
      title: "Castle Crashers: Stolen Sun",
      category: "Arcade",
      tags: ["2D", "Action", "Adventure", "Fighting"],
      description:
        "A colourful 2D brawler across a kingdom robbed of daylight. Choose an elemental knight, run 36 stages with optional routes and take down the bosses.",
      instructions:
        "WASD/arrows to move, J or left-click to strike, K or right-click for skills, Space to jump, Esc for options.",
      url: "https://html5.gamemonetize.co/j67nn0xyjyyxlvu0qsy2q2evtfzave25/",
      thumb: "https://img.gamemonetize.com/j67nn0xyjyyxlvu0qsy2q2evtfzave25/512x384.jpg",
      width: 800,
      height: 600
    },
    {
      id: "89712",
      slug: "kingmoon",
      title: "Kingmoon",
      category: "Shooting",
      tags: ["3D", "Space", "Action", "Flight"],
      description:
        "A 3D space action game: fly low over five worlds, land, fight on foot and plant your flag to claim each sector. Call your mech when the fight gets heavy.",
      instructions:
        "W/S throttle and brake, A/D turn, mouse to aim, click to fire, Shift for nitro, E to land, F to plant the flag.",
      url: "https://html5.gamemonetize.co/8ivrit0sy8f6enghyz1h1ke1u9tul1f1/",
      thumb: "https://img.gamemonetize.com/8ivrit0sy8f6enghyz1h1ke1u9tul1f1/512x384.jpg",
      width: 1280,
      height: 720
    },
    {
      id: "87665",
      slug: "carletto-halloween-dreams",
      title: "Carletto Halloween Dreams",
      category: "Puzzle",
      tags: ["Adventure", "Halloween", "Platform", "Brain"],
      description:
        "Guide Carletto through haunted forests and glowing castles, dodge pumpkin creatures, collect 90 stars and face the giant Pumpkin Phantom.",
      instructions:
        "A/D to move, W or Space to jump, hold Z/E for the telescope, X/F to interact, R to restart.",
      url: "https://html5.gamemonetize.co/k527vlavp39s5fiqshntacxi9zl7ette/",
      thumb: "https://img.gamemonetize.com/k527vlavp39s5fiqshntacxi9zl7ette/512x384.jpg",
      width: 1280,
      height: 720
    },
    {
      id: "90312",
      slug: "crazy-cart",
      title: "Crazy Cart",
      category: "Puzzle",
      tags: ["Physics", "Casual", "Hypercasual"],
      description:
        "Balance a wobbly cart stacked with colourful shapes. Collect, stack and deliver without dropping the load across increasingly awkward levels.",
      instructions: "Click or tap to play.",
      url: "https://html5.gamemonetize.co/86mboqa4elofmu8yp5zb2joi7z7w360p/",
      thumb: "https://img.gamemonetize.com/86mboqa4elofmu8yp5zb2joi7z7w360p/512x384.jpg",
      width: 720,
      height: 1280
    },
    {
      id: "88176",
      slug: "storky-survivors",
      title: "Storky Survivors",
      category: "Shooting",
      tags: ["Survival", "Bullet", "Action", "3D"],
      description:
        "Play as Rookie Storky: pick weapons and upgrades, collect gems, beat giant bosses and survive ten stages of Glitchlings plus endless mode.",
      instructions:
        "WASD/arrows to move — weapons fire automatically. Choose an upgrade each time you level up.",
      url: "https://html5.gamemonetize.co/jdggpyd1fydnoj38wdzmj5mgcoib3mez/",
      thumb: "https://img.gamemonetize.com/jdggpyd1fydnoj38wdzmj5mgcoib3mez/512x384.jpg",
      width: 1280,
      height: 720
    },
    {
      id: "90315",
      slug: "timber-truck-city-cargo-driver",
      title: "Timber Truck: City Cargo Driver",
      category: "3D",
      tags: ["Truck", "Transport", "Simulation", "Racing"],
      description:
        "Get behind the wheel of a heavy timber truck, keep the cargo balanced down rough roads and deliver every load in one piece.",
      instructions:
        "W/up to accelerate, S/down to brake and reverse, A/D to steer, Space for the handbrake.",
      url: "https://html5.gamemonetize.co/v1av2um005eaey07qvqg75nj8802tn0t/",
      thumb: "https://img.gamemonetize.com/v1av2um005eaey07qvqg75nj8802tn0t/512x384.jpg",
      width: 800,
      height: 600
    },
    {
      id: "90310",
      slug: "precision-parking-city-driver",
      title: "Precision Parking: City Driver",
      category: "3D",
      tags: ["Parking", "Simulation", "Car"],
      description:
        "A 3D parking challenge: thread tight levels, dodge obstacles and slot the car into the marked spot without a scratch.",
      instructions:
        "W/up to accelerate, S/down to brake and reverse, A/D to steer, Space for the handbrake.",
      url: "https://html5.gamemonetize.co/1ji3wtl07z2i7zu4i031wokvuadrczg0/",
      thumb: "https://img.gamemonetize.com/1ji3wtl07z2i7zu4i031wokvuadrczg0/512x384.jpg",
      width: 800,
      height: 600
    },
    {
      id: "89835",
      slug: "cage-ballers-football",
      title: "Cage Ballers Football",
      category: "Sports",
      tags: ["Soccer", "3D", "Multiplayer"],
      description:
        "Fast 3D cage football. Choose your pitch, kit, match length and difficulty, then pass, sprint, tackle and shoot — level scores go to golden goal.",
      instructions:
        "WASD/arrows to move, Shift to sprint, Space to shoot, E to pass, R for a through ball, C to change camera.",
      url: "https://html5.gamemonetize.co/q1wpzkogglzb4m0lkme3jw9cenxd62wn/",
      thumb: "https://img.gamemonetize.com/q1wpzkogglzb4m0lkme3jw9cenxd62wn/512x384.jpg",
      width: 800,
      height: 600
    },
    {
      id: "90193",
      slug: "spookily-stylish-duo",
      title: "Spookily Stylish Duo",
      category: "Girls",
      tags: ["Dress Up", "Fashion", "Decoration", "Halloween"],
      description:
        "Style Arelia and Tiara in autumn looks, then decorate the house and courtyard for a cosy, spooky season.",
      instructions: "Click or tap to dress up, accessorise and decorate.",
      url: "https://html5.gamemonetize.co/a336yt8j3zffqnt6pmgkv53hkmilmqkj/",
      thumb: "https://img.gamemonetize.com/a336yt8j3zffqnt6pmgkv53hkmilmqkj/512x384.jpg",
      width: 800,
      height: 600
    },
    {
      id: "89934",
      slug: "car-parking-master-3d",
      title: "Car Parking Master 3D",
      category: "Boys",
      tags: ["Car", "Parking", "3D", "Driving"],
      description:
        "Realistic cars, awkward parking spots and level after level of precision driving. Follow the signs, avoid obstacles and park like a pro.",
      instructions: "W/up to accelerate, S/down to brake and reverse, A/D to steer.",
      url: "https://html5.gamemonetize.co/d4jpgfpyn7z30yabw1zx4vjsttli37oi/",
      thumb: "https://img.gamemonetize.com/d4jpgfpyn7z30yabw1zx4vjsttli37oi/512x384.jpg",
      width: 1280,
      height: 720
    },
    {
      id: "89617",
      slug: "nitrovenant-2",
      title: "Nitrovenant 2",
      category: "Racing",
      tags: ["Zombie", "Car", "Action", "Shooting"],
      description:
        "Drive an armoured car through endless zombie hordes, jumping potholes, firing the rooftop launcher and clearing 120 stages across six worlds.",
      instructions:
        "A/D or arrows to change lanes, Space or W to jump, hold R for nitro, P to pause. Swipe on mobile.",
      url: "https://html5.gamemonetize.co/ed75dp117q2ubh1knkucn3vmmqcxs42o/",
      thumb: "https://img.gamemonetize.com/ed75dp117q2ubh1knkucn3vmmqcxs42o/512x384.jpg",
      width: 960,
      height: 540
    },
    {
      id: "88994",
      slug: "vlinder-garden-dress-princess",
      title: "Vlinder Garden Dress Princess",
      category: "Hypercasual",
      tags: ["Dress Up", "Cute", "Relaxation"],
      description:
        "A creative dress-up and design game: style characters, craft accessories, decorate rooms and build your own fantasy world.",
      instructions: "Tap and drag to play.",
      url: "https://html5.gamemonetize.co/amwb5pr7cpylj9me9yff04jz04919307/",
      thumb: "https://img.gamemonetize.com/amwb5pr7cpylj9me9yff04jz04919307/512x384.jpg",
      width: 1600,
      height: 720
    },
    {
      id: "89773",
      slug: "panda-run-1",
      title: "Panda Run 1",
      category: "Adventure",
      tags: ["Running", "1 Player", "Casual"],
      description:
        "Jump, slide and dodge through four biomes and 200 levels, complete missions and unlock skins on the way to a high score.",
      instructions: "WASD to move.",
      url: "https://html5.gamemonetize.co/r771adpx4j9ki0krbv21ghs7rte1s3m0/",
      thumb: "https://img.gamemonetize.com/r771adpx4j9ki0krbv21ghs7rte1s3m0/512x384.jpg",
      width: 800,
      height: 600
    },
    {
      id: "89731",
      slug: "turbo-boat-runner-3d",
      title: "Turbo Boat Runner 3D",
      category: "Adventure",
      tags: ["Boat", "Race", "3D", "Water"],
      description:
        "Pilot a speedboat across open water: dodge obstacles, master sharp turns and collect coins at full throttle.",
      instructions: "WASD to steer and control your boat.",
      url: "https://html5.gamemonetize.co/65hvflaol93wykizugyk64b3cu3ixda5/",
      thumb: "https://img.gamemonetize.com/65hvflaol93wykizugyk64b3cu3ixda5/512x384.jpg",
      width: 800,
      height: 600
    },
    {
      id: "89718",
      slug: "stickman-skybow",
      title: "Stickman Skybow",
      category: "Stickman",
      tags: ["Archery", "2D", "Action", "Shooting"],
      description:
        "A fast 2D archery game with Duel and Defense modes. Draw, aim and release against bosses and waves, then spend coins on bows and heroes.",
      instructions:
        "Drag left to charge the bow, drag down to aim higher, release to shoot. Pick arrows with keys 1–8.",
      url: "https://html5.gamemonetize.co/tsrm1mntua4si64m2i6nx9vzh24t8l7j/",
      thumb: "https://img.gamemonetize.com/tsrm1mntua4si64m2i6nx9vzh24t8l7j/512x384.jpg",
      width: 1280,
      height: 720
    },
    {
      id: "89898",
      slug: "swat-ops-body-camera",
      title: "SWAT OPS: Body Camera",
      category: "Shooting",
      tags: ["FPS", "Gun", "Multiplayer", "Zombie"],
      description:
        "A fast first-person shooter with deathmatch, team deathmatch, gun game, zombies, bomb and co-op across day-and-night maps.",
      instructions:
        "WASD to move, mouse to aim, left-click to shoot, right-click to zoom, R to reload.",
      url: "https://html5.gamemonetize.co/bx312w4jjwnk8huztiw6ufyr71etcwhc/",
      thumb: "https://img.gamemonetize.com/bx312w4jjwnk8huztiw6ufyr71etcwhc/512x384.jpg",
      width: 1366,
      height: 768
    },
    {
      id: "89987",
      slug: "needle-rush",
      title: "Needle Rush",
      category: "Hypercasual",
      tags: ["Idle", "Simulator", "Collecting", "3D"],
      description:
        "Sweep a giant haystack with a metal detector, dig up 48 odd needles and build a hay factory that keeps working while you're away.",
      instructions:
        "WASD/arrows to move, mouse to look, hold left-click to dig, Space to jump, B for build mode.",
      url: "https://html5.gamemonetize.co/h5775frghqj0eznzryr6zzhh7khems8p/",
      thumb: "https://img.gamemonetize.com/h5775frghqj0eznzryr6zzhh7khems8p/512x384.jpg",
      width: 1280,
      height: 720
    },
    {
      id: "87972",
      slug: "color-coin-merge",
      title: "Color Coin Merge",
      category: "Puzzle",
      tags: ["Match 3", "Logic", "Sorting", "Relaxation"],
      description:
        "Slot coloured coins, merge them to clear the board and lean on power-ups as the levels get faster and trickier.",
      instructions:
        "Place coins in the slots and merge them to clear the board. Hammer, Free Move, Shuffle and Time Slot are your power-ups.",
      url: "https://html5.gamemonetize.co/6y5sqinffpm6cyzzn2av6sj1iamo9lmv/",
      thumb: "https://img.gamemonetize.com/6y5sqinffpm6cyzzn2av6sj1iamo9lmv/512x384.jpg",
      width: 800,
      height: 600
    },
    {
      id: "89893",
      slug: "modern-strike-shooting-game",
      title: "Modern Strike Shooting Game",
      category: "Shooting",
      tags: ["FPS", "Action", "War"],
      description:
        "A first-person shooter built on aim, quick reactions and tactical positioning. Clear the battlefield one firefight at a time.",
      instructions: "WASD to move, mouse to aim, click to fire.",
      url: "https://html5.gamemonetize.co/gb1p2hjo6ij6h733k1regku3jwuvk98s/",
      thumb: "https://img.gamemonetize.com/gb1p2hjo6ij6h733k1regku3jwuvk98s/512x384.jpg",
      width: 800,
      height: 600
    },
  ]
};
