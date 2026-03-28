// National suburb database — every major greenfield growth suburb in Australia
// Organised by state → corridor → suburb
// This is the master list for scraping targets

const NATIONAL_SUBURBS = {
  VIC: {
    Western: [
      { suburb: 'Melton South', postcode: '3338', lga: 'Melton' },
      { suburb: 'Brookfield', postcode: '3338', lga: 'Melton' },
      { suburb: 'Thornhill Park', postcode: '3335', lga: 'Melton' },
      { suburb: 'Cobblebank', postcode: '3338', lga: 'Melton' },
      { suburb: 'Weir Views', postcode: '3338', lga: 'Melton' },
      { suburb: 'Bonnie Brook', postcode: '3335', lga: 'Melton' },
      { suburb: 'Aintree', postcode: '3336', lga: 'Melton' },
      { suburb: 'Fraser Rise', postcode: '3336', lga: 'Melton' },
      { suburb: 'Plumpton', postcode: '3335', lga: 'Melton' },
      { suburb: 'Rockbank', postcode: '3335', lga: 'Melton' },
      { suburb: 'Tarneit', postcode: '3029', lga: 'Wyndham' },
      { suburb: 'Truganina', postcode: '3029', lga: 'Wyndham' },
      { suburb: 'Wyndham Vale', postcode: '3024', lga: 'Wyndham' },
      { suburb: 'Manor Lakes', postcode: '3024', lga: 'Wyndham' },
      { suburb: 'Point Cook', postcode: '3030', lga: 'Wyndham' },
      { suburb: 'Werribee', postcode: '3030', lga: 'Wyndham' },
      { suburb: 'Williams Landing', postcode: '3027', lga: 'Wyndham' },
    ],
    Northern: [
      { suburb: 'Craigieburn', postcode: '3064', lga: 'Hume' },
      { suburb: 'Mickleham', postcode: '3064', lga: 'Hume' },
      { suburb: 'Kalkallo', postcode: '3064', lga: 'Hume' },
      { suburb: 'Donnybrook', postcode: '3064', lga: 'Hume' },
      { suburb: 'Sunbury', postcode: '3429', lga: 'Hume' },
      { suburb: 'Diggers Rest', postcode: '3427', lga: 'Melton' },
      { suburb: 'Wollert', postcode: '3750', lga: 'Whittlesea' },
      { suburb: 'Mernda', postcode: '3754', lga: 'Whittlesea' },
      { suburb: 'Doreen', postcode: '3754', lga: 'Whittlesea' },
      { suburb: 'Epping', postcode: '3076', lga: 'Whittlesea' },
      { suburb: 'Beveridge', postcode: '3753', lga: 'Mitchell' },
      { suburb: 'Wallan', postcode: '3756', lga: 'Mitchell' },
      { suburb: 'Kilmore', postcode: '3764', lga: 'Mitchell' },
    ],
    'South Eastern': [
      { suburb: 'Cranbourne East', postcode: '3977', lga: 'Casey' },
      { suburb: 'Cranbourne West', postcode: '3977', lga: 'Casey' },
      { suburb: 'Cranbourne South', postcode: '3977', lga: 'Casey' },
      { suburb: 'Clyde', postcode: '3978', lga: 'Casey' },
      { suburb: 'Clyde North', postcode: '3978', lga: 'Casey' },
      { suburb: 'Botanic Ridge', postcode: '3977', lga: 'Casey' },
      { suburb: 'Officer', postcode: '3809', lga: 'Cardinia' },
      { suburb: 'Officer South', postcode: '3809', lga: 'Cardinia' },
      { suburb: 'Pakenham', postcode: '3810', lga: 'Cardinia' },
      { suburb: 'Beaconsfield', postcode: '3807', lga: 'Cardinia' },
    ],
    Geelong: [
      { suburb: 'Armstrong Creek', postcode: '3217', lga: 'Greater Geelong' },
      { suburb: 'Charlemont', postcode: '3217', lga: 'Greater Geelong' },
      { suburb: 'Mount Duneed', postcode: '3217', lga: 'Greater Geelong' },
      { suburb: 'Lara', postcode: '3212', lga: 'Greater Geelong' },
      { suburb: 'Leopold', postcode: '3224', lga: 'Greater Geelong' },
      { suburb: 'Lovely Banks', postcode: '3213', lga: 'Greater Geelong' },
      { suburb: 'Fyansford', postcode: '3218', lga: 'Greater Geelong' },
    ],
    Ballarat: [
      { suburb: 'Lucas', postcode: '3350', lga: 'Ballarat' },
      { suburb: 'Alfredton', postcode: '3350', lga: 'Ballarat' },
      { suburb: 'Winter Valley', postcode: '3358', lga: 'Ballarat' },
      { suburb: 'Smythes Creek', postcode: '3351', lga: 'Ballarat' },
      { suburb: 'Bonshaw', postcode: '3352', lga: 'Ballarat' },
      { suburb: 'Delacombe', postcode: '3356', lga: 'Ballarat' },
      { suburb: 'Miners Rest', postcode: '3352', lga: 'Ballarat' },
      { suburb: 'Mount Rowan', postcode: '3352', lga: 'Ballarat' },
      { suburb: 'Cardigan', postcode: '3352', lga: 'Ballarat' },
    ],
    Bendigo: [
      { suburb: 'Strathfieldsaye', postcode: '3551', lga: 'Greater Bendigo' },
      { suburb: 'Huntly', postcode: '3551', lga: 'Greater Bendigo' },
      { suburb: 'Epsom', postcode: '3551', lga: 'Greater Bendigo' },
      { suburb: 'Maiden Gully', postcode: '3551', lga: 'Greater Bendigo' },
      { suburb: 'Kangaroo Flat', postcode: '3555', lga: 'Greater Bendigo' },
      { suburb: 'Jackass Flat', postcode: '3556', lga: 'Greater Bendigo' },
    ],
    Shepparton: [
      { suburb: 'Shepparton', postcode: '3630', lga: 'Greater Shepparton' },
      { suburb: 'Kialla', postcode: '3631', lga: 'Greater Shepparton' },
      { suburb: 'Mooroopna', postcode: '3629', lga: 'Greater Shepparton' },
    ],
    'North East': [
      { suburb: 'Wangaratta', postcode: '3677', lga: 'Wangaratta' },
      { suburb: 'Wodonga', postcode: '3690', lga: 'Wodonga' },
      { suburb: 'Baranduda', postcode: '3691', lga: 'Wodonga' },
    ],
    'Latrobe Valley': [
      { suburb: 'Warragul', postcode: '3820', lga: 'Baw Baw' },
      { suburb: 'Drouin', postcode: '3818', lga: 'Baw Baw' },
      { suburb: 'Traralgon', postcode: '3844', lga: 'Latrobe' },
      { suburb: 'Moe', postcode: '3825', lga: 'Latrobe' },
    ],
    Seymour: [
      { suburb: 'Seymour', postcode: '3660', lga: 'Mitchell' },
    ],
  },
  NSW: {
    'South West': [
      { suburb: 'Oran Park', postcode: '2570', lga: 'Camden' },
      { suburb: 'Leppington', postcode: '2179', lga: 'Camden' },
      { suburb: 'Gregory Hills', postcode: '2557', lga: 'Camden' },
      { suburb: 'Cobbitty', postcode: '2570', lga: 'Camden' },
      { suburb: 'Spring Farm', postcode: '2570', lga: 'Camden' },
      { suburb: 'Gledswood Hills', postcode: '2557', lga: 'Camden' },
      { suburb: 'Wilton', postcode: '2571', lga: 'Wollondilly' },
      { suburb: 'Bingara Gorge', postcode: '2571', lga: 'Wollondilly' },
      { suburb: 'Marsden Park', postcode: '2765', lga: 'Blacktown' },
      { suburb: 'Box Hill', postcode: '2765', lga: 'The Hills' },
    ],
    'North West': [
      { suburb: 'Schofields', postcode: '2762', lga: 'Blacktown' },
      { suburb: 'Riverstone', postcode: '2765', lga: 'Blacktown' },
      { suburb: 'The Ponds', postcode: '2769', lga: 'Blacktown' },
      { suburb: 'Tallawong', postcode: '2762', lga: 'Blacktown' },
      { suburb: 'Kellyville', postcode: '2155', lga: 'The Hills' },
      { suburb: 'North Kellyville', postcode: '2155', lga: 'The Hills' },
      { suburb: 'Rouse Hill', postcode: '2155', lga: 'The Hills' },
    ],
    'Central Coast': [
      { suburb: 'Hamlyn Terrace', postcode: '2259', lga: 'Central Coast' },
      { suburb: 'Wadalba', postcode: '2259', lga: 'Central Coast' },
      { suburb: 'Woongarrah', postcode: '2259', lga: 'Central Coast' },
      { suburb: 'Charmhaven', postcode: '2263', lga: 'Central Coast' },
    ],
    Hunter: [
      { suburb: 'Thornton', postcode: '2322', lga: 'Maitland' },
      { suburb: 'Chisholm', postcode: '2322', lga: 'Maitland' },
      { suburb: 'Gillieston Heights', postcode: '2321', lga: 'Maitland' },
      { suburb: 'Aberglasslyn', postcode: '2320', lga: 'Maitland' },
      { suburb: 'Cameron Park', postcode: '2285', lga: 'Lake Macquarie' },
      { suburb: 'Cooranbong', postcode: '2265', lga: 'Lake Macquarie' },
    ],
    Illawarra: [
      { suburb: 'Calderwood', postcode: '2527', lga: 'Shellharbour' },
      { suburb: 'Shell Cove', postcode: '2529', lga: 'Shellharbour' },
      { suburb: 'Tullimbar', postcode: '2527', lga: 'Shellharbour' },
    ],
  },
  QLD: {
    'North Lakes': [
      { suburb: 'North Lakes', postcode: '4509', lga: 'Moreton Bay' },
      { suburb: 'Mango Hill', postcode: '4509', lga: 'Moreton Bay' },
      { suburb: 'Caboolture South', postcode: '4510', lga: 'Moreton Bay' },
      { suburb: 'Burpengary East', postcode: '4505', lga: 'Moreton Bay' },
      { suburb: 'Narangba', postcode: '4504', lga: 'Moreton Bay' },
      { suburb: 'Dakabin', postcode: '4503', lga: 'Moreton Bay' },
    ],
    Ipswich: [
      { suburb: 'Springfield', postcode: '4300', lga: 'Ipswich' },
      { suburb: 'Springfield Lakes', postcode: '4300', lga: 'Ipswich' },
      { suburb: 'Augustine Heights', postcode: '4300', lga: 'Ipswich' },
      { suburb: 'Ripley', postcode: '4306', lga: 'Ipswich' },
      { suburb: 'Deebing Heights', postcode: '4306', lga: 'Ipswich' },
      { suburb: 'Walloon', postcode: '4306', lga: 'Ipswich' },
    ],
    Logan: [
      { suburb: 'Yarrabilba', postcode: '4207', lga: 'Logan' },
      { suburb: 'Park Ridge', postcode: '4125', lga: 'Logan' },
      { suburb: 'Flagstone', postcode: '4280', lga: 'Logan' },
      { suburb: 'Jimboomba', postcode: '4280', lga: 'Logan' },
    ],
    'Gold Coast': [
      { suburb: 'Coomera', postcode: '4209', lga: 'Gold Coast' },
      { suburb: 'Pimpama', postcode: '4209', lga: 'Gold Coast' },
      { suburb: 'Ormeau', postcode: '4208', lga: 'Gold Coast' },
      { suburb: 'Ormeau Hills', postcode: '4208', lga: 'Gold Coast' },
      { suburb: 'Upper Coomera', postcode: '4209', lga: 'Gold Coast' },
      { suburb: 'Jacobs Well', postcode: '4208', lga: 'Gold Coast' },
    ],
    'Sunshine Coast': [
      { suburb: 'Caloundra West', postcode: '4551', lga: 'Sunshine Coast' },
      { suburb: 'Aura', postcode: '4551', lga: 'Sunshine Coast' },
      { suburb: 'Palmview', postcode: '4553', lga: 'Sunshine Coast' },
      { suburb: 'Baringa', postcode: '4551', lga: 'Sunshine Coast' },
      { suburb: 'Nirimba', postcode: '4551', lga: 'Sunshine Coast' },
    ],
    Townsville: [
      { suburb: 'Burdell', postcode: '4818', lga: 'Townsville' },
      { suburb: 'Bushland Beach', postcode: '4818', lga: 'Townsville' },
      { suburb: 'Mount Low', postcode: '4818', lga: 'Townsville' },
    ],
  },
  SA: {
    'Northern Adelaide': [
      { suburb: 'Munno Para West', postcode: '5115', lga: 'Playford' },
      { suburb: 'Angle Vale', postcode: '5117', lga: 'Playford' },
      { suburb: 'Eyre', postcode: '5121', lga: 'Playford' },
      { suburb: 'Davoren Park', postcode: '5113', lga: 'Playford' },
      { suburb: 'Virginia', postcode: '5120', lga: 'Playford' },
      { suburb: 'Riverlea', postcode: '5120', lga: 'Playford' },
      { suburb: 'Two Wells', postcode: '5501', lga: 'Adelaide Plains' },
    ],
    'Southern Adelaide': [
      { suburb: 'Seaford Heights', postcode: '5169', lga: 'Onkaparinga' },
      { suburb: 'Hackham', postcode: '5163', lga: 'Onkaparinga' },
      { suburb: 'Aldinga Beach', postcode: '5173', lga: 'Onkaparinga' },
      { suburb: 'Sellicks Beach', postcode: '5174', lga: 'Onkaparinga' },
      { suburb: 'Mount Barker', postcode: '5251', lga: 'Mount Barker' },
    ],
    'Murray Bridge': [
      { suburb: 'Murray Bridge', postcode: '5253', lga: 'Rural City of Murray Bridge' },
    ],
    'Mount Gambier': [
      { suburb: 'Mount Gambier', postcode: '5290', lga: 'Mount Gambier' },
    ],
  },
  WA: {
    'North Perth': [
      { suburb: 'Yanchep', postcode: '6035', lga: 'Wanneroo' },
      { suburb: 'Two Rocks', postcode: '6037', lga: 'Wanneroo' },
      { suburb: 'Alkimos', postcode: '6038', lga: 'Wanneroo' },
      { suburb: 'Clarkson', postcode: '6030', lga: 'Wanneroo' },
      { suburb: 'Butler', postcode: '6036', lga: 'Wanneroo' },
      { suburb: 'Eglinton', postcode: '6034', lga: 'Wanneroo' },
      { suburb: 'Jindalee', postcode: '6036', lga: 'Wanneroo' },
    ],
    'South Perth Metro': [
      { suburb: 'Baldivis', postcode: '6171', lga: 'Rockingham' },
      { suburb: 'Wellard', postcode: '6170', lga: 'Kwinana' },
      { suburb: 'Piara Waters', postcode: '6112', lga: 'Armadale' },
      { suburb: 'Harrisdale', postcode: '6112', lga: 'Armadale' },
      { suburb: 'Byford', postcode: '6122', lga: 'Serpentine-Jarrahdale' },
      { suburb: 'Mundijong', postcode: '6123', lga: 'Serpentine-Jarrahdale' },
    ],
    'East Perth': [
      { suburb: 'Ellenbrook', postcode: '6069', lga: 'Swan' },
      { suburb: 'The Vines', postcode: '6069', lga: 'Swan' },
      { suburb: 'Brabham', postcode: '6055', lga: 'Swan' },
      { suburb: 'Aveley', postcode: '6069', lga: 'Swan' },
      { suburb: 'Dayton', postcode: '6055', lga: 'Swan' },
    ],
    Mandurah: [
      { suburb: 'Lakelands', postcode: '6180', lga: 'Mandurah' },
      { suburb: 'Meadow Springs', postcode: '6210', lga: 'Mandurah' },
      { suburb: 'Madora Bay', postcode: '6210', lga: 'Mandurah' },
    ],
    Bunbury: [
      { suburb: 'Dalyellup', postcode: '6230', lga: 'Capel' },
      { suburb: 'Eaton', postcode: '6232', lga: 'Dardanup' },
    ],
  },
  TAS: {
    Hobart: [
      { suburb: 'Kingston', postcode: '7050', lga: 'Kingborough' },
      { suburb: 'Howrah', postcode: '7018', lga: 'Clarence' },
      { suburb: 'Sorell', postcode: '7172', lga: 'Sorell' },
    ],
    Launceston: [
      { suburb: 'Prospect Vale', postcode: '7250', lga: 'Meander Valley' },
      { suburb: 'Legana', postcode: '7277', lga: 'West Tamar' },
      { suburb: 'Riverside', postcode: '7250', lga: 'West Tamar' },
    ],
  },
  NT: {
    Darwin: [
      { suburb: 'Palmerston', postcode: '0830', lga: 'Palmerston' },
      { suburb: 'Zuccoli', postcode: '0832', lga: 'Palmerston' },
      { suburb: 'Muirhead', postcode: '0810', lga: 'Darwin' },
    ],
  },
  ACT: {
    Canberra: [
      { suburb: 'Whitlam', postcode: '2611', lga: 'ACT' },
      { suburb: 'Taylor', postcode: '2913', lga: 'ACT' },
      { suburb: 'Throsby', postcode: '2914', lga: 'ACT' },
      { suburb: 'Denman Prospect', postcode: '2611', lga: 'ACT' },
      { suburb: 'Strathnairn', postcode: '2615', lga: 'ACT' },
    ],
  },
};

// Flatten to array for scraping
function getAllSuburbs(stateFilter, corridorFilter) {
  const result = [];
  for (const [state, corridors] of Object.entries(NATIONAL_SUBURBS)) {
    if (stateFilter && state !== stateFilter) continue;
    for (const [corridor, suburbs] of Object.entries(corridors)) {
      if (corridorFilter && corridor !== corridorFilter) continue;
      for (const s of suburbs) {
        result.push({
          ...s,
          state,
          corridor,
        });
      }
    }
  }
  return result;
}

function getStateSummary() {
  const summary = {};
  for (const [state, corridors] of Object.entries(NATIONAL_SUBURBS)) {
    const corridorCount = Object.keys(corridors).length;
    let suburbCount = 0;
    for (const suburbs of Object.values(corridors)) suburbCount += suburbs.length;
    summary[state] = { corridors: corridorCount, suburbs: suburbCount };
  }
  return summary;
}

module.exports = { NATIONAL_SUBURBS, getAllSuburbs, getStateSummary };
