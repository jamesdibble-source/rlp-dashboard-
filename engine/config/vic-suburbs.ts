// Victorian suburbs with active greenfield land markets
// Organized by growth corridor → LGA → suburbs with postcodes
// This drives the scraping pipeline — scraper iterates through each suburb

export interface SuburbEntry {
  suburb: string
  postcode: string
  lga: string
  corridor: string
  state: 'VIC'
}

export const VIC_SUBURBS: SuburbEntry[] = [
  // === WESTERN CORRIDOR ===
  // Melton
  { suburb: 'Melton South', postcode: '3338', lga: 'Melton', corridor: 'Western', state: 'VIC' },
  { suburb: 'Melton West', postcode: '3337', lga: 'Melton', corridor: 'Western', state: 'VIC' },
  { suburb: 'Brookfield', postcode: '3338', lga: 'Melton', corridor: 'Western', state: 'VIC' },
  { suburb: 'Thornhill Park', postcode: '3335', lga: 'Melton', corridor: 'Western', state: 'VIC' },
  { suburb: 'Cobblebank', postcode: '3338', lga: 'Melton', corridor: 'Western', state: 'VIC' },
  { suburb: 'Strathtulloh', postcode: '3338', lga: 'Melton', corridor: 'Western', state: 'VIC' },
  { suburb: 'Weir Views', postcode: '3338', lga: 'Melton', corridor: 'Western', state: 'VIC' },
  { suburb: 'Bonnie Brook', postcode: '3335', lga: 'Melton', corridor: 'Western', state: 'VIC' },
  { suburb: 'Aintree', postcode: '3336', lga: 'Melton', corridor: 'Western', state: 'VIC' },
  { suburb: 'Fraser Rise', postcode: '3336', lga: 'Melton', corridor: 'Western', state: 'VIC' },
  { suburb: 'Grangefields', postcode: '3336', lga: 'Melton', corridor: 'Western', state: 'VIC' },
  // Wyndham
  { suburb: 'Tarneit', postcode: '3029', lga: 'Wyndham', corridor: 'Western', state: 'VIC' },
  { suburb: 'Truganina', postcode: '3029', lga: 'Wyndham', corridor: 'Western', state: 'VIC' },
  { suburb: 'Wyndham Vale', postcode: '3024', lga: 'Wyndham', corridor: 'Western', state: 'VIC' },
  { suburb: 'Manor Lakes', postcode: '3024', lga: 'Wyndham', corridor: 'Western', state: 'VIC' },
  { suburb: 'Point Cook', postcode: '3030', lga: 'Wyndham', corridor: 'Western', state: 'VIC' },
  { suburb: 'Williams Landing', postcode: '3027', lga: 'Wyndham', corridor: 'Western', state: 'VIC' },
  { suburb: 'Werribee', postcode: '3030', lga: 'Wyndham', corridor: 'Western', state: 'VIC' },

  // === NORTHERN CORRIDOR ===
  // Hume
  { suburb: 'Craigieburn', postcode: '3064', lga: 'Hume', corridor: 'Northern', state: 'VIC' },
  { suburb: 'Mickleham', postcode: '3064', lga: 'Hume', corridor: 'Northern', state: 'VIC' },
  { suburb: 'Kalkallo', postcode: '3064', lga: 'Hume', corridor: 'Northern', state: 'VIC' },
  { suburb: 'Donnybrook', postcode: '3064', lga: 'Hume', corridor: 'Northern', state: 'VIC' },
  { suburb: 'Sunbury', postcode: '3429', lga: 'Hume', corridor: 'Northern', state: 'VIC' },
  { suburb: 'Greenvale', postcode: '3059', lga: 'Hume', corridor: 'Northern', state: 'VIC' },
  // Whittlesea
  { suburb: 'Wollert', postcode: '3750', lga: 'Whittlesea', corridor: 'Northern', state: 'VIC' },
  { suburb: 'Mernda', postcode: '3754', lga: 'Whittlesea', corridor: 'Northern', state: 'VIC' },
  { suburb: 'Doreen', postcode: '3754', lga: 'Whittlesea', corridor: 'Northern', state: 'VIC' },
  { suburb: 'Epping', postcode: '3076', lga: 'Whittlesea', corridor: 'Northern', state: 'VIC' },
  // Mitchell
  { suburb: 'Beveridge', postcode: '3753', lga: 'Mitchell', corridor: 'Northern', state: 'VIC' },
  { suburb: 'Wallan', postcode: '3756', lga: 'Mitchell', corridor: 'Northern', state: 'VIC' },
  { suburb: 'Kilmore', postcode: '3764', lga: 'Mitchell', corridor: 'Northern', state: 'VIC' },

  // === SOUTH EASTERN CORRIDOR ===
  // Casey
  { suburb: 'Cranbourne', postcode: '3977', lga: 'Casey', corridor: 'South Eastern', state: 'VIC' },
  { suburb: 'Cranbourne East', postcode: '3977', lga: 'Casey', corridor: 'South Eastern', state: 'VIC' },
  { suburb: 'Cranbourne West', postcode: '3977', lga: 'Casey', corridor: 'South Eastern', state: 'VIC' },
  { suburb: 'Clyde', postcode: '3978', lga: 'Casey', corridor: 'South Eastern', state: 'VIC' },
  { suburb: 'Clyde North', postcode: '3978', lga: 'Casey', corridor: 'South Eastern', state: 'VIC' },
  { suburb: 'Botanic Ridge', postcode: '3977', lga: 'Casey', corridor: 'South Eastern', state: 'VIC' },
  { suburb: 'Berwick', postcode: '3806', lga: 'Casey', corridor: 'South Eastern', state: 'VIC' },
  // Cardinia
  { suburb: 'Officer', postcode: '3809', lga: 'Cardinia', corridor: 'South Eastern', state: 'VIC' },
  { suburb: 'Pakenham', postcode: '3810', lga: 'Cardinia', corridor: 'South Eastern', state: 'VIC' },
  { suburb: 'Beaconsfield', postcode: '3807', lga: 'Cardinia', corridor: 'South Eastern', state: 'VIC' },

  // === GEELONG ===
  { suburb: 'Armstrong Creek', postcode: '3217', lga: 'Greater Geelong', corridor: 'Geelong', state: 'VIC' },
  { suburb: 'Charlemont', postcode: '3217', lga: 'Greater Geelong', corridor: 'Geelong', state: 'VIC' },
  { suburb: 'Mount Duneed', postcode: '3217', lga: 'Greater Geelong', corridor: 'Geelong', state: 'VIC' },
  { suburb: 'Lara', postcode: '3212', lga: 'Greater Geelong', corridor: 'Geelong', state: 'VIC' },
  { suburb: 'Leopold', postcode: '3224', lga: 'Greater Geelong', corridor: 'Geelong', state: 'VIC' },
  { suburb: 'Lovely Banks', postcode: '3213', lga: 'Greater Geelong', corridor: 'Geelong', state: 'VIC' },

  // === BALLARAT ===
  { suburb: 'Lucas', postcode: '3350', lga: 'Ballarat', corridor: 'Ballarat', state: 'VIC' },
  { suburb: 'Alfredton', postcode: '3350', lga: 'Ballarat', corridor: 'Ballarat', state: 'VIC' },
  { suburb: 'Winter Valley', postcode: '3358', lga: 'Ballarat', corridor: 'Ballarat', state: 'VIC' },
  { suburb: 'Smythes Creek', postcode: '3351', lga: 'Ballarat', corridor: 'Ballarat', state: 'VIC' },
  { suburb: 'Bonshaw', postcode: '3352', lga: 'Ballarat', corridor: 'Ballarat', state: 'VIC' },
  { suburb: 'Delacombe', postcode: '3356', lga: 'Ballarat', corridor: 'Ballarat', state: 'VIC' },
  { suburb: 'Miners Rest', postcode: '3352', lga: 'Ballarat', corridor: 'Ballarat', state: 'VIC' },
  { suburb: 'Sebastopol', postcode: '3356', lga: 'Ballarat', corridor: 'Ballarat', state: 'VIC' },
  { suburb: 'Brown Hill', postcode: '3350', lga: 'Ballarat', corridor: 'Ballarat', state: 'VIC' },
  { suburb: 'Canadian', postcode: '3350', lga: 'Ballarat', corridor: 'Ballarat', state: 'VIC' },
  { suburb: 'Invermay Park', postcode: '3350', lga: 'Ballarat', corridor: 'Ballarat', state: 'VIC' },

  // === BENDIGO ===
  { suburb: 'Strathfieldsaye', postcode: '3551', lga: 'Greater Bendigo', corridor: 'Bendigo', state: 'VIC' },
  { suburb: 'Huntly', postcode: '3551', lga: 'Greater Bendigo', corridor: 'Bendigo', state: 'VIC' },
  { suburb: 'Epsom', postcode: '3551', lga: 'Greater Bendigo', corridor: 'Bendigo', state: 'VIC' },
  { suburb: 'Maiden Gully', postcode: '3551', lga: 'Greater Bendigo', corridor: 'Bendigo', state: 'VIC' },
  { suburb: 'Kangaroo Flat', postcode: '3555', lga: 'Greater Bendigo', corridor: 'Bendigo', state: 'VIC' },

  // === WANGARATTA / NORTH EAST ===
  { suburb: 'Wangaratta', postcode: '3677', lga: 'Wangaratta', corridor: 'North East', state: 'VIC' },

  // === SHEPPARTON ===
  { suburb: 'Shepparton', postcode: '3630', lga: 'Greater Shepparton', corridor: 'Shepparton', state: 'VIC' },
  { suburb: 'Kialla', postcode: '3631', lga: 'Greater Shepparton', corridor: 'Shepparton', state: 'VIC' },
  { suburb: 'Mooroopna', postcode: '3629', lga: 'Greater Shepparton', corridor: 'Shepparton', state: 'VIC' },

  // === BAW BAW / LATROBE ===
  { suburb: 'Warragul', postcode: '3820', lga: 'Baw Baw', corridor: 'Latrobe Valley', state: 'VIC' },
  { suburb: 'Drouin', postcode: '3818', lga: 'Baw Baw', corridor: 'Latrobe Valley', state: 'VIC' },
  { suburb: 'Traralgon', postcode: '3844', lga: 'Latrobe', corridor: 'Latrobe Valley', state: 'VIC' },

  // === SEYMOUR / MITCHELL ===
  { suburb: 'Seymour', postcode: '3660', lga: 'Mitchell', corridor: 'Northern', state: 'VIC' },
]

// Total: ~75 suburbs across all VIC growth corridors
// This covers the major greenfield markets that RPM and Oliver Hume track
