(() => {
  'use strict';

  const GAME_NAME = 'CITY LINK';
  const GAME_VERSION = '2';
  const ROUND_COUNT = 5;
  const MIN_COMPARISON_COVERAGE = 0.70;
  const CATEGORY_MIN_FIELD_COVERAGE = 0.50;
  const TIE_EPSILON = 1e-12;
  const DEBUG = false;

  const PUZZLE_GENERATION_CONFIG = Object.freeze({
    maxAttemptsPerRound: 40,
    minSeedSimilarity: 0.25,
    maxSeedSimilarity: 0.80,
    minBestAnswerSimilarity: 0.55,
    minFirstSecondGap: 0.002,
    maxFirstSecondGap: 0.08,
    minFirstTenthGap: 0.03
  });

  const EXPECTED_SCHEMA = Object.freeze({
    environment: [
      'latitude',
      'elevation_m',
      'avg_annual_temp_c',
      'avg_summer_high_c',
      'avg_winter_low_c',
      'annual_precipitation_mm',
      'avg_relative_humidity_pct',
      'annual_sunshine_hours',
      'koppen_climate',
      'distance_to_coast_km',
      'terrain_type',
      'water_setting'
    ],
    scale: [
      'city_population',
      'metro_population',
      'metro_density_per_km2',
      'metro_area_km2',
      'population_growth_rate_pct',
      'national_city_rank',
      'share_of_national_population_pct',
      'tall_building_density'
    ],
    urban_form: [
      'car_modal_share_pct',
      'transit_modal_share_pct',
      'walking_modal_share_pct',
      'cycling_modal_share_pct',
      'rapid_transit_network_km',
      'street_intersection_density'
    ],
    economy: [
      'gdp_per_capita_usd',
      'metro_gdp_usd',
      'manufacturing_intensity',
      'finance_intensity',
      'technology_research_intensity',
      'tourism_intensity',
      'logistics_port_intensity'
    ],
    culture: [
      'primary_language',
      'secondary_language',
      'language_family',
      'cultural_region'
    ],
    history: [
      'founding_year',
      'historical_era',
      'capital_status',
      'former_capital'
    ],
    connectivity: [
      'airport_passengers_annual',
      'international_air_destinations',
      'foreign_born_population_pct',
      'port_importance',
      'international_tourist_arrivals_annual'
    ]
  });

  const NUMERIC_FIELDS = new Set([
    'environment.latitude',
    'environment.elevation_m',
    'environment.avg_annual_temp_c',
    'environment.avg_summer_high_c',
    'environment.avg_winter_low_c',
    'environment.annual_precipitation_mm',
    'environment.avg_relative_humidity_pct',
    'environment.annual_sunshine_hours',
    'environment.distance_to_coast_km',

    'scale.city_population',
    'scale.metro_population',
    'scale.metro_density_per_km2',
    'scale.metro_area_km2',
    'scale.population_growth_rate_pct',
    'scale.national_city_rank',
    'scale.share_of_national_population_pct',
    'scale.tall_building_density',

    'urban_form.car_modal_share_pct',
    'urban_form.transit_modal_share_pct',
    'urban_form.walking_modal_share_pct',
    'urban_form.cycling_modal_share_pct',
    'urban_form.rapid_transit_network_km',
    'urban_form.street_intersection_density',

    'economy.gdp_per_capita_usd',
    'economy.metro_gdp_usd',
    'economy.manufacturing_intensity',
    'economy.finance_intensity',
    'economy.technology_research_intensity',
    'economy.tourism_intensity',
    'economy.logistics_port_intensity',

    'history.founding_year',

    'connectivity.airport_passengers_annual',
    'connectivity.international_air_destinations',
    'connectivity.foreign_born_population_pct',
    'connectivity.port_importance',
    'connectivity.international_tourist_arrivals_annual'
  ]);

  const BOOLEAN_FIELDS = new Set([
    'history.former_capital'
  ]);

  const RECOGNIZED_COMPARATORS = new Set([
    'absolute_distance',
    'percentage_distance',
    'log_ratio',
    'log_rank_distance',
    'boolean_match',
    'koppen_hierarchy',
    'similarity_matrix',
    'historical_date_distance',
    'historical_era',
    'language_similarity',
    'language_family_hierarchy'
  ]);

  const RECOGNIZED_MATRICES = new Set([
    'terrain',
    'water',
    'capital_status',
    'cultural_region'
  ]);

  const KOPPEN_RELATED = Object.freeze({
    'A|C': 0.45,
    'B|C': 0.40,
    'B|D': 0.25,
    'C|D': 0.50,
    'D|E': 0.40
  });

  const TERRAIN_SIMILARITY = Object.freeze({
    'flat|rolling': 0.78,
    'flat|hilly': 0.50,
    'flat|mountainous': 0.15,
    'flat|basin': 0.55,
    'flat|plateau': 0.40,
    'flat|valley': 0.45,

    'rolling|hilly': 0.86,
    'rolling|mountainous': 0.45,
    'rolling|basin': 0.62,
    'rolling|plateau': 0.60,
    'rolling|valley': 0.65,

    'hilly|mountainous': 0.80,
    'hilly|basin': 0.55,
    'hilly|plateau': 0.68,
    'hilly|valley': 0.75,

    'mountainous|basin': 0.45,
    'mountainous|plateau': 0.65,
    'mountainous|valley': 0.82,

    'basin|plateau': 0.50,
    'basin|valley': 0.72,
    'plateau|valley': 0.55
  });

  const WATER_SIMILARITY = Object.freeze({
    'ocean_coast|sea_coast': 0.95,
    'ocean_coast|large_lake': 0.55,
    'ocean_coast|major_river': 0.45,
    'ocean_coast|river_and_coast': 0.90,
    'ocean_coast|inland': 0.15,
    'ocean_coast|island': 0.88,

    'sea_coast|large_lake': 0.58,
    'sea_coast|major_river': 0.48,
    'sea_coast|river_and_coast': 0.90,
    'sea_coast|inland': 0.18,
    'sea_coast|island': 0.86,

    'large_lake|major_river': 0.62,
    'large_lake|river_and_coast': 0.55,
    'large_lake|inland': 0.45,
    'large_lake|island': 0.50,

    'major_river|river_and_coast': 0.78,
    'major_river|inland': 0.50,
    'major_river|island': 0.35,

    'river_and_coast|inland': 0.20,
    'river_and_coast|island': 0.80,

    'inland|island': 0.08
  });

  const CAPITAL_STATUS_SIMILARITY = Object.freeze({
    'national_capital|regional_capital': 0.62,
    'national_capital|former_national_capital': 0.75,
    'national_capital|former_imperial_capital': 0.72,
    'national_capital|non_capital': 0.25,

    'regional_capital|former_national_capital': 0.58,
    'regional_capital|former_imperial_capital': 0.50,
    'regional_capital|non_capital': 0.55,

    'former_national_capital|former_imperial_capital': 0.78,
    'former_national_capital|non_capital': 0.45,

    'former_imperial_capital|non_capital': 0.42
  });

  const CULTURAL_REGION_SIMILARITY = Object.freeze({
    'north_america_us_canada|latin_america': 0.38,
    'north_america_us_canada|western_europe': 0.55,
    'north_america_us_canada|northern_europe': 0.48,
    'north_america_us_canada|southern_europe': 0.40,
    'north_america_us_canada|eastern_europe': 0.30,
    'north_america_us_canada|middle_east_north_africa': 0.22,
    'north_america_us_canada|sub_saharan_africa': 0.18,
    'north_america_us_canada|south_asia': 0.20,
    'north_america_us_canada|east_asia': 0.28,
    'north_america_us_canada|southeast_asia': 0.24,
    'north_america_us_canada|oceania': 0.55,

    'latin_america|western_europe': 0.48,
    'latin_america|northern_europe': 0.32,
    'latin_america|southern_europe': 0.70,
    'latin_america|eastern_europe': 0.25,
    'latin_america|middle_east_north_africa': 0.25,
    'latin_america|sub_saharan_africa': 0.22,
    'latin_america|south_asia': 0.18,
    'latin_america|east_asia': 0.20,
    'latin_america|southeast_asia': 0.18,
    'latin_america|oceania': 0.30,

    'western_europe|northern_europe': 0.80,
    'western_europe|southern_europe': 0.75,
    'western_europe|eastern_europe': 0.58,
    'western_europe|middle_east_north_africa': 0.32,
    'western_europe|sub_saharan_africa': 0.20,
    'western_europe|south_asia': 0.24,
    'western_europe|east_asia': 0.30,
    'western_europe|southeast_asia': 0.25,
    'western_europe|oceania': 0.55,

    'northern_europe|southern_europe': 0.62,
    'northern_europe|eastern_europe': 0.60,
    'northern_europe|middle_east_north_africa': 0.22,
    'northern_europe|sub_saharan_africa': 0.15,
    'northern_europe|south_asia': 0.20,
    'northern_europe|east_asia': 0.28,
    'northern_europe|southeast_asia': 0.22,
    'northern_europe|oceania': 0.52,

    'southern_europe|eastern_europe': 0.58,
    'southern_europe|middle_east_north_africa': 0.45,
    'southern_europe|sub_saharan_africa': 0.20,
    'southern_europe|south_asia': 0.22,
    'southern_europe|east_asia': 0.25,
    'southern_europe|southeast_asia': 0.20,
    'southern_europe|oceania': 0.40,

    'eastern_europe|middle_east_north_africa': 0.35,
    'eastern_europe|sub_saharan_africa': 0.15,
    'eastern_europe|south_asia': 0.22,
    'eastern_europe|east_asia': 0.30,
    'eastern_europe|southeast_asia': 0.20,
    'eastern_europe|oceania': 0.28,

    'middle_east_north_africa|sub_saharan_africa': 0.42,
    'middle_east_north_africa|south_asia': 0.42,
    'middle_east_north_africa|east_asia': 0.20,
    'middle_east_north_africa|southeast_asia': 0.25,
    'middle_east_north_africa|oceania': 0.18,

    'sub_saharan_africa|south_asia': 0.25,
    'sub_saharan_africa|east_asia': 0.18,
    'sub_saharan_africa|southeast_asia': 0.22,
    'sub_saharan_africa|oceania': 0.20,

    'south_asia|east_asia': 0.32,
    'south_asia|southeast_asia': 0.55,
    'south_asia|oceania': 0.28,

    'east_asia|southeast_asia': 0.62,
    'east_asia|oceania': 0.35,

    'southeast_asia|oceania': 0.45
  });

  const HISTORICAL_ERAS = Object.freeze([
    'ancient',
    'classical',
    'medieval',
    'early_modern',
    'industrial',
    'modern',
    'planned_contemporary'
  ]);

  const HISTORICAL_ERA_SCORE = Object.freeze({
    0: 1.00,
    1: 0.82,
    2: 0.62,
    3: 0.42,
    4: 0.25,
    5: 0.15,
    6: 0.08
  });

  const LANGUAGE_HIERARCHY = Object.freeze({
    'Indo-European': {
      Romance: [
        'Spanish',
        'Portuguese',
        'Italian',
        'French',
        'Romanian',
        'Catalan'
      ],
      Germanic: [
        'English',
        'German',
        'Dutch',
        'Afrikaans',
        'Swedish',
        'Norwegian',
        'Danish',
        'Icelandic'
      ],
      Slavic: [
        'Russian',
        'Ukrainian',
        'Polish',
        'Czech',
        'Slovak',
        'Bulgarian',
        'Serbian',
        'Croatian',
        'Bosnian',
        'Slovenian',
        'Macedonian'
      ],
      'Indo-Aryan': [
        'Hindi',
        'Urdu',
        'Bengali',
        'Punjabi',
        'Marathi',
        'Gujarati',
        'Nepali',
        'Sinhala'
      ],
      Iranian: [
        'Persian',
        'Kurdish',
        'Pashto'
      ],
      Hellenic: [
        'Greek'
      ],
      Baltic: [
        'Lithuanian',
        'Latvian'
      ],
      Celtic: [
        'Irish',
        'Welsh'
      ]
    },

    'Sino-Tibetan': {
      Sinitic: [
        'Mandarin',
        'Cantonese',
        'Wu Chinese',
        'Min Chinese'
      ],
      'Tibeto-Burman': [
        'Burmese',
        'Tibetan'
      ]
    },

    'Afro-Asiatic': {
      Semitic: [
        'Arabic',
        'Hebrew',
        'Amharic',
        'Tigrinya'
      ],
      Berber: [
        'Tamazight'
      ]
    },

    Austronesian: {
      'Malayo-Polynesian': [
        'Indonesian',
        'Malay',
        'Tagalog',
        'Javanese',
        'Cebuano',
        'Malagasy'
      ]
    },

    Turkic: {
      Turkic: [
        'Turkish',
        'Azerbaijani',
        'Kazakh',
        'Uzbek',
        'Turkmen',
        'Kyrgyz'
      ]
    },

    Dravidian: {
      Dravidian: [
        'Tamil',
        'Telugu',
        'Kannada',
        'Malayalam'
      ]
    },

    Uralic: {
      Finnic: [
        'Finnish',
        'Estonian'
      ],
      Ugric: [
        'Hungarian'
      ]
    },

    Japonic: {
      Japonic: [
        'Japanese'
      ]
    },

    Koreanic: {
      Koreanic: [
        'Korean'
      ]
    },

    Austroasiatic: {
      'Mon-Khmer': [
        'Vietnamese',
        'Khmer'
      ]
    },

    'Tai-Kadai': {
      Tai: [
        'Thai',
        'Lao'
      ]
    },

    'Niger-Congo': {
      Bantu: [
        'Swahili',
        'Zulu',
        'Xhosa'
      ],
      Other: [
        'Yoruba',
        'Igbo'
      ]
    }
  });

  const LANGUAGE_OVERRIDES = Object.freeze({
    'Spanish|Portuguese': 0.93,
    'Spanish|Catalan': 0.92,
    'Spanish|Italian': 0.86,
    'Spanish|French': 0.76,
    'Portuguese|Italian': 0.82,
    'Portuguese|French': 0.74,
    'Italian|French': 0.80,

    'English|Dutch': 0.72,
    'English|German': 0.66,
    'Dutch|German': 0.82,

    'Swedish|Norwegian': 0.94,
    'Swedish|Danish': 0.88,
    'Norwegian|Danish': 0.92,

    'Hindi|Urdu': 0.95,

    'Serbian|Croatian': 0.95,
    'Serbian|Bosnian': 0.93,
    'Croatian|Bosnian': 0.95,

    'Russian|Ukrainian': 0.84,

    'Czech|Slovak': 0.93,

    'Indonesian|Malay': 0.94,

    'Turkish|Azerbaijani': 0.86
  });

  const LANGUAGE_ALIASES = Object.freeze({
    'mandarin chinese': 'Mandarin',
    'chinese': 'Mandarin',
    'shanghainese': 'Wu Chinese',
    'filipino': 'Tagalog'
  });

  const FAMILY_ALIASES = Object.freeze({
    'kra-dai': 'Tai-Kadai'
  });

  const CULTURAL_REGION_CANONICAL = Object.freeze({
    'Anglo-American': 'north_america_us_canada',
    'Midwestern American': 'north_america_us_canada',
    'Northern Californian': 'north_america_us_canada',
    'Southern Californian': 'north_america_us_canada',
    'Canadian': 'north_america_us_canada',
    'Pacific Canadian': 'north_america_us_canada',

    'Mexican': 'latin_america',
    'Southeastern Brazilian': 'latin_america',
    'Rioplatense': 'latin_america',
    'Peruvian Coastal': 'latin_america',
    'Andean Colombian': 'latin_america',

    'British': 'northern_europe',
    'Nordic': 'northern_europe',

    'French': 'western_europe',
    'German': 'western_europe',
    'Dutch': 'western_europe',
    'Central European': 'western_europe',

    'Castilian': 'southern_europe',
    'Central Italian': 'southern_europe',
    'Northern Italian': 'southern_europe',
    'Greek': 'southern_europe',

    'Polish': 'eastern_europe',
    'Russian': 'eastern_europe',

    'Egyptian Arab': 'middle_east_north_africa',
    'Gulf Arab': 'middle_east_north_africa',
    'Anatolian': 'middle_east_north_africa',
    'Iranian': 'middle_east_north_africa',

    'Cape South African': 'sub_saharan_africa',
    'South African': 'sub_saharan_africa',
    'East African': 'sub_saharan_africa',
    'West African': 'sub_saharan_africa',

    'Western Indian': 'south_asia',
    'North Indian': 'south_asia',
    'South Asian': 'south_asia',

    'Japanese': 'east_asia',
    'Korean': 'east_asia',
    'East Chinese': 'east_asia',
    'North Chinese': 'east_asia',
    'Cantonese': 'east_asia',

    'Southeast Asian': 'southeast_asia',
    'Indonesian': 'southeast_asia',
    'Filipino': 'southeast_asia',
    'Malaysian': 'southeast_asia',
    'Thai': 'southeast_asia',

    'Australian': 'oceania'
  });

  const FIELD_LABELS = Object.freeze({
    latitude: 'Latitude',
    elevation_m: 'Elevation',
    avg_annual_temp_c: 'Average temperature',
    avg_summer_high_c: 'Summer high',
    avg_winter_low_c: 'Winter low',
    annual_precipitation_mm: 'Annual precipitation',
    avg_relative_humidity_pct: 'Relative humidity',
    annual_sunshine_hours: 'Annual sunshine',
    koppen_climate: 'Köppen climate',
    distance_to_coast_km: 'Distance to coast',
    terrain_type: 'Terrain',
    water_setting: 'Water setting',

    city_population: 'City population',
    metro_population: 'Metro population',
    metro_density_per_km2: 'Metro density',
    metro_area_km2: 'Metro area',
    population_growth_rate_pct: 'Population growth',
    national_city_rank: 'National city rank',
    share_of_national_population_pct: 'National population share',
    tall_building_density: 'Tall-building density',

    car_modal_share_pct: 'Car usage',
    transit_modal_share_pct: 'Transit usage',
    walking_modal_share_pct: 'Walking',
    cycling_modal_share_pct: 'Cycling',
    rapid_transit_network_km: 'Rapid-transit network',
    street_intersection_density: 'Street intersection density',

    gdp_per_capita_usd: 'GDP per capita',
    metro_gdp_usd: 'Metro GDP',
    manufacturing_intensity: 'Manufacturing intensity',
    finance_intensity: 'Finance intensity',
    technology_research_intensity: 'Technology & research',
    tourism_intensity: 'Tourism intensity',
    logistics_port_intensity: 'Logistics & port intensity',

    primary_language: 'Primary language',
    secondary_language: 'Secondary language',
    language_family: 'Language family',
    cultural_region: 'Cultural region',

    founding_year: 'Founding era',
    historical_era: 'Historical era',
    capital_status: 'Capital status',
    former_capital: 'Former capital status',

    airport_passengers_annual: 'Airport passenger volume',
    international_air_destinations: 'International air connectivity',
    foreign_born_population_pct: 'Foreign-born population',
    port_importance: 'Port importance',
    international_tourist_arrivals_annual: 'International tourism'
  });

  const app = {
    data: null,
    weights: null,

    cityById: new Map(),
    cityMeta: new Map(),
    nameIndex: new Map(),
    sortedIds: [],

    languageIndex: new Map(),
    comparisonCache: new Map(),
    warnedRelationships: new Set(),

    session: null,

    inputState: {
      resolvedId: null,
      suggestions: [],
      activeIndex: -1,
      menuType: null
    }
  };

  const dom = {};

  document.addEventListener('DOMContentLoaded', init);

  async function init() {
    cacheDom();
    bindStaticEvents();

    try {
      const [
        cityResponse,
        weightResponse
      ] = await Promise.all([
        fetch('./city_info.json'),
        fetch('./field_weights.json')
      ]);

      if (!cityResponse.ok) {
        throw new Error(
          `city_info.json returned HTTP ${cityResponse.status}`
        );
      }

      if (!weightResponse.ok) {
        throw new Error(
          `field_weights.json returned HTTP ${weightResponse.status}`
        );
      }

      const [
        data,
        weights
      ] = await Promise.all([
        cityResponse.json(),
        weightResponse.json()
      ]);

      validateAll(data, weights);

      app.data = data;
      app.weights = weights;

      buildLanguageIndex();
      buildIndexes();

      dom.app.setAttribute(
        'aria-busy',
        'false'
      );

      renderWelcome();

    } catch (error) {
      console.error(
        'City Link initialization failed:',
        error
      );

      showFatal(
        error instanceof Error
          ? error.message
          : String(error)
      );
    }
  }

  function cacheDom() {
    Object.assign(dom, {
      app: document.getElementById('app'),

      loading:
        document.getElementById('loading-screen'),

      fatal:
        document.getElementById('fatal-screen'),

      fatalMessage:
        document.getElementById('fatal-message'),

      welcome:
        document.getElementById('welcome-screen'),

      game:
        document.getElementById('game-screen'),

      final:
        document.getElementById('final-screen'),

      dailyButton:
        document.getElementById('daily-button'),

      infiniteButton:
        document.getElementById('infinite-button'),

      cumulativeScore:
        document.getElementById('cumulative-score'),

      progressSquares:
        document.getElementById('progress-squares'),

      roundIndicator:
        document.getElementById('round-indicator'),

      ribbonDate:
        document.getElementById('ribbon-date'),

      gameCanvas:
        document.getElementById('game-canvas'),

      primaryControl:
        document.getElementById('primary-control'),

      finalMode:
        document.getElementById('final-mode'),

      finalDate:
        document.getElementById('final-date'),

      finalRounds:
        document.getElementById('final-rounds'),

      finalTotalScore:
        document.getElementById('final-total-score'),

      copyScoreButton:
        document.getElementById('copy-score-button'),

      newSessionButton:
        document.getElementById('new-session-button'),

      copyStatus:
        document.getElementById('copy-status')
    });
  }

  function bindStaticEvents() {
    dom.dailyButton.addEventListener(
      'click',
      () => startMode('daily')
    );

    dom.infiniteButton.addEventListener(
      'click',
      () => startMode('infinite')
    );

    dom.primaryControl.addEventListener(
      'click',
      handlePrimaryControl
    );

    dom.copyScoreButton.addEventListener(
      'click',
      copyScore
    );

    dom.newSessionButton.addEventListener(
      'click',
      () => {
        app.session = null;
        app.comparisonCache.clear();
        renderWelcome();
      }
    );
  }

  function showFatal(message) {
    hideAllScreens();

    dom.fatal.hidden = false;
    dom.fatalMessage.textContent = message;

    dom.app.setAttribute(
      'aria-busy',
      'false'
    );
  }

  function hideAllScreens() {
    dom.loading.hidden = true;
    dom.fatal.hidden = true;
    dom.welcome.hidden = true;
    dom.game.hidden = true;
    dom.final.hidden = true;
  }

  function validateAll(data, weights) {
    if (
      !Array.isArray(data) ||
      data.length === 0
    ) {
      throw new Error(
        'city_info.json must be a non-empty top-level array.'
      );
    }

    if (
      !weights ||
      typeof weights !== 'object' ||
      Array.isArray(weights)
    ) {
      throw new Error(
        'field_weights.json must be a JSON object.'
      );
    }

    if (
      !weights.category_weights ||
      typeof weights.category_weights !== 'object'
    ) {
      throw new Error(
        'field_weights.json is missing category_weights.'
      );
    }

    if (
      !weights.field_config ||
      typeof weights.field_config !== 'object'
    ) {
      throw new Error(
        'field_weights.json is missing field_config.'
      );
    }

    const seenIds = new Set();

    for (
      const [
        index,
        city
      ] of data.entries()
    ) {
      validateCity(
        city,
        index,
        seenIds
      );
    }

    validateWeights(weights);

    if (data.length < 12) {
      throw new Error(
        'The dataset needs at least 12 cities for reliable five-round puzzle generation.'
      );
    }
  }

  function validateCity(
    city,
    index,
    seenIds
  ) {
    if (
      !city ||
      typeof city !== 'object' ||
      Array.isArray(city)
    ) {
      throw new Error(
        `City record ${index + 1} is not an object.`
      );
    }

    const identity = city.identity;

    if (
      !identity ||
      typeof identity !== 'object'
    ) {
      throw new Error(
        `City record ${index + 1} is missing identity.`
      );
    }

    if (
      typeof identity.city !== 'string' ||
      !identity.city.trim()
    ) {
      throw new Error(
        `City record ${index + 1} has no identity.city.`
      );
    }

    if (
      typeof identity.country !== 'string' ||
      !identity.country.trim()
    ) {
      throw new Error(
        `City record ${index + 1} has no identity.country.`
      );
    }

    for (
      const key of [
        'region',
        'subregion'
      ]
    ) {
      if (
        typeof identity[key] !== 'string'
      ) {
        throw new Error(
          `${identity.city}: identity.${key} must be a string.`
        );
      }
    }

    const id = stableCityId(city);

    if (seenIds.has(id)) {
      throw new Error(
        `Duplicate full city identity: ${identity.city}, ${identity.country}.`
      );
    }

    seenIds.add(id);

    for (
      const [
        category,
        fields
      ] of Object.entries(EXPECTED_SCHEMA)
    ) {
      if (
        !city[category] ||
        typeof city[category] !== 'object' ||
        Array.isArray(city[category])
      ) {
        throw new Error(
          `${identity.city}: missing category ${category}.`
        );
      }

      for (
        const field of fields
      ) {
        if (!(field in city[category])) {
          throw new Error(
            `${identity.city}: missing field ${category}.${field}.`
          );
        }

        const value =
          city[category][field];

        const path =
          `${category}.${field}`;

        if (isMissing(value)) {
          continue;
        }

        if (
          NUMERIC_FIELDS.has(path) &&
          (
            typeof value !== 'number' ||
            !Number.isFinite(value)
          )
        ) {
          throw new Error(
            `${identity.city}: ${path} must be a finite number or null.`
          );
        }

        if (
          BOOLEAN_FIELDS.has(path) &&
          typeof value !== 'boolean'
        ) {
          throw new Error(
            `${identity.city}: ${path} must be a boolean or null.`
          );
        }

        if (
          !NUMERIC_FIELDS.has(path) &&
          !BOOLEAN_FIELDS.has(path) &&
          typeof value !== 'string'
        ) {
          throw new Error(
            `${identity.city}: ${path} must be a string or null.`
          );
        }
      }
    }
  }

  function validateWeights(weights) {
    const categories =
      Object.keys(EXPECTED_SCHEMA);

    const categoryWeightSum =
      categories.reduce(
        (sum, cat) => {
          const w =
            weights.category_weights[cat];

          if (
            typeof w !== 'number' ||
            !Number.isFinite(w) ||
            w < 0
          ) {
            throw new Error(
              `Invalid category weight for ${cat}.`
            );
          }

          return sum + w;
        },
        0
      );

    if (
      Math.abs(
        categoryWeightSum - 1
      ) > 1e-9
    ) {
      throw new Error(
        `Category weights must sum to 1.0; found ${categoryWeightSum}.`
      );
    }

    for (
      const category of categories
    ) {
      const fieldConfig =
        weights.field_config[category];

      if (
        !fieldConfig ||
        typeof fieldConfig !== 'object'
      ) {
        throw new Error(
          `Missing field_config.${category}.`
        );
      }

      const expected =
        EXPECTED_SCHEMA[category];

      for (
        const field of Object.keys(
          fieldConfig
        )
      ) {
        if (!expected.includes(field)) {
          throw new Error(
            `Unknown configured field ${category}.${field}.`
          );
        }
      }

      for (
        const field of expected
      ) {
        if (!fieldConfig[field]) {
          throw new Error(
            `Missing configuration for ${category}.${field}.`
          );
        }
      }

      let sum = 0;

      for (
        const field of expected
      ) {
        const cfg =
          fieldConfig[field];

        if (
          typeof cfg.weight !== 'number' ||
          !Number.isFinite(cfg.weight) ||
          cfg.weight < 0
        ) {
          throw new Error(
            `Invalid field weight for ${category}.${field}.`
          );
        }

        if (
          !RECOGNIZED_COMPARATORS.has(
            cfg.type
          )
        ) {
          throw new Error(
            `Unknown comparator type ${cfg.type} for ${category}.${field}.`
          );
        }

        if (
          [
            'absolute_distance',
            'percentage_distance',
            'log_ratio',
            'log_rank_distance'
          ].includes(cfg.type) &&
          (
            typeof cfg.sensitivity !== 'number' ||
            !Number.isFinite(cfg.sensitivity) ||
            cfg.sensitivity <= 0
          )
        ) {
          throw new Error(
            `Invalid sensitivity for ${category}.${field}.`
          );
        }

        if (
          cfg.type === 'similarity_matrix' &&
          !RECOGNIZED_MATRICES.has(
            cfg.matrix
          )
        ) {
          throw new Error(
            `Unknown matrix ${cfg.matrix} for ${category}.${field}.`
          );
        }

        if (
          cfg.type === 'boolean_match' &&
          (
            typeof cfg.mismatch_score !== 'number' ||
            !Number.isFinite(
              cfg.mismatch_score
            )
          )
        ) {
          throw new Error(
            `Invalid mismatch_score for ${category}.${field}.`
          );
        }

        sum += cfg.weight;
      }

      if (
        Math.abs(
          sum - 1
        ) > 1e-9
      ) {
        throw new Error(
          `${category} field weights must sum to 1.0; found ${sum}.`
        );
      }
    }
  }

  function buildLanguageIndex() {
    app.languageIndex.clear();

    for (
      const [
        family,
        branches
      ] of Object.entries(
        LANGUAGE_HIERARCHY
      )
    ) {
      for (
        const [
          branch,
          languages
        ] of Object.entries(branches)
      ) {
        for (
          const language of languages
        ) {
          app.languageIndex.set(
            language,
            {
              family,
              branch
            }
          );
        }
      }
    }
  }

  function buildIndexes() {
    app.cityById.clear();
    app.cityMeta.clear();
    app.nameIndex.clear();

    for (
      const city of app.data
    ) {
      const id =
        stableCityId(city);

      app.cityById.set(
        id,
        city
      );

      const nameKey =
        normalizeText(
          city.identity.city
        );

      if (
        !app.nameIndex.has(nameKey)
      ) {
        app.nameIndex.set(
          nameKey,
          []
        );
      }

      app.nameIndex
        .get(nameKey)
        .push(id);

      app.cityMeta.set(
        id,
        {
          id,

          normalizedName:
            nameKey,

          normalizedCountry:
            normalizeText(
              city.identity.country
            ),

          canonical:
            buildCanonicalMetadata(
              city
            )
        }
      );
    }

    for (
      const ids of app.nameIndex.values()
    ) {
      ids.sort(
        (a, b) =>
          a.localeCompare(b)
      );
    }

    app.sortedIds =
      [
        ...app.cityById.keys()
      ].sort(
        (a, b) =>
          a.localeCompare(b)
      );
  }

  function buildCanonicalMetadata(city) {
    return {
      terrain:
        canonicalTerrain(
          city.environment.terrain_type
        ),

      water:
        canonicalWater(
          city.environment.water_setting
        ),

      cultural_region:
        canonicalCulturalRegion(
          city.culture.cultural_region,
          city.identity
        ),

      capital_status:
        canonicalCapitalStatus(
          city.history.capital_status
        ),

      historical_era:
        canonicalHistoricalEra(
          city.history.historical_era
        ),

      primary_language:
        canonicalLanguage(
          city.culture.primary_language
        ),

      secondary_language:
        canonicalLanguage(
          city.culture.secondary_language
        ),

      language_family:
        canonicalLanguageFamily(
          city.culture.language_family
        )
    };
  }

  function normalizeText(value) {
    return String(value ?? '')
      .normalize('NFKD')
      .replace(
        /[\u0300-\u036f]/g,
        ''
      )
      .replace(
        /[‘’‚‛]/g,
        "'"
      )
      .replace(
        /[‐-‒–—―]/g,
        '-'
      )
      .toLowerCase()
      .replace(
        /[.]/g,
        ''
      )
      .replace(
        /[^a-z0-9'\-\s,]/g,
        ' '
      )
      .replace(
        /\s+/g,
        ' '
      )
      .trim();
  }

  function stableCityId(city) {
    return [
      'city',
      'country',
      'region',
      'subregion'
    ]
      .map(
        key =>
          normalizeText(
            city.identity[key]
          )
      )
      .join('|');
  }

  function isMissing(value) {
    return (
      value === null ||
      value === undefined ||
      (
        typeof value === 'string' &&
        value.trim() === ''
      ) ||
      (
        typeof value === 'number' &&
        !Number.isFinite(value)
      )
    );
  }

  function canonicalTerrain(raw) {
    const v =
      normalizeText(raw)
        .replace(
          /-/g,
          ' '
        );

    if (!v) {
      return '';
    }

    if (
      [
        'flat',
        'rolling',
        'hilly',
        'mountainous',
        'basin',
        'plateau',
        'valley'
      ].includes(v)
    ) {
      return v;
    }

    if (
      v.includes('basin')
    ) {
      return 'basin';
    }

    if (
      v.includes('plateau') ||
      v.includes('highveld')
    ) {
      return 'plateau';
    }

    if (
      v.includes('valley')
    ) {
      return 'valley';
    }

    if (
      v.includes('foothill')
    ) {
      return 'rolling';
    }

    if (
      v.includes('mountain')
    ) {
      return 'mountainous';
    }

    if (
      v.includes('rolling')
    ) {
      return 'rolling';
    }

    if (
      v.includes('hill') ||
      v.includes('highland')
    ) {
      return 'hilly';
    }

    if (
      v.includes('plain') ||
      v.includes('delta') ||
      v.includes('desert') ||
      v.includes('lagoon') ||
      v.includes('archipelago') ||
      v.includes('peninsula')
    ) {
      return 'flat';
    }

    return v;
  }

  function canonicalWater(raw) {
    const v =
      normalizeText(raw)
        .replace(
          /-/g,
          ' '
        );

    if (!v) {
      return '';
    }

    if (
      [
        'ocean_coast',
        'sea_coast',
        'large_lake',
        'major_river',
        'river_and_coast',
        'inland',
        'island'
      ].includes(v)
    ) {
      return v;
    }

    if (
      v === 'none' ||
      v === 'reservoirs'
    ) {
      return 'inland';
    }

    const hasRiver =
      /river|canal|estuary/.test(v);

    const hasCoast =
      /ocean|sea|harbor|bay|strait|gulf|lagoon/.test(v);

    if (
      hasRiver &&
      hasCoast
    ) {
      return 'river_and_coast';
    }

    if (
      v.includes('island') ||
      v.includes('archipelago')
    ) {
      return 'island';
    }

    if (
      /ocean|pacific/.test(v) ||
      /harbor|bay|lagoon/.test(v)
    ) {
      return 'ocean_coast';
    }

    if (
      /sea|gulf|strait/.test(v)
    ) {
      return 'sea_coast';
    }

    if (
      /lake/.test(v)
    ) {
      return 'large_lake';
    }

    if (
      /river|canal|reservoir/.test(v)
    ) {
      return 'major_river';
    }

    return 'inland';
  }

  function canonicalCapitalStatus(raw) {
    const v =
      normalizeText(raw)
        .replace(
          /[\s-]+/g,
          '_'
        );

    if (!v) {
      return '';
    }

    if (
      [
        'national_capital',
        'regional_capital',
        'former_national_capital',
        'former_imperial_capital',
        'non_capital'
      ].includes(v)
    ) {
      return v;
    }

    if (
      v.includes('former') &&
      v.includes('imperial')
    ) {
      return 'former_imperial_capital';
    }

    if (
      v.includes('former')
    ) {
      return 'former_national_capital';
    }

    if (
      v.includes('national') ||
      v.includes('legislative')
    ) {
      return 'national_capital';
    }

    if (
      v === 'none' ||
      v.includes('non_capital')
    ) {
      return 'non_capital';
    }

    if (
      /regional|state|provincial|emirate|municipality|administrative_region/.test(v) ||
      v.includes(
        'special_administrative'
      )
    ) {
      return 'regional_capital';
    }

    return v;
  }

  function canonicalHistoricalEra(raw) {
    return normalizeText(raw)
      .replace(
        /[\s-]+/g,
        '_'
      );
  }

  function canonicalLanguage(raw) {
    const trimmed =
      String(raw ?? '')
        .trim();

    if (!trimmed) {
      return '';
    }

    return (
      LANGUAGE_ALIASES[
        normalizeText(trimmed)
      ] ||
      trimmed
    );
  }

  function canonicalLanguageFamily(raw) {
    const trimmed =
      String(raw ?? '')
        .trim();

    if (!trimmed) {
      return '';
    }

    return (
      FAMILY_ALIASES[
        normalizeText(trimmed)
      ] ||
      trimmed
    );
  }

  function canonicalCulturalRegion(
    raw,
    identity
  ) {
    const trimmed =
      String(raw ?? '')
        .trim();

    if (
      CULTURAL_REGION_CANONICAL[
        trimmed
      ]
    ) {
      return (
        CULTURAL_REGION_CANONICAL[
          trimmed
        ]
      );
    }

    const sub =
      normalizeText(
        identity?.subregion || ''
      );

    const country =
      normalizeText(
        identity?.country || ''
      );

    if (
      sub.includes(
        'northern america'
      ) ||
      [
        'united states',
        'canada'
      ].includes(country)
    ) {
      return 'north_america_us_canada';
    }

    if (
      sub.includes(
        'south america'
      ) ||
      sub.includes(
        'central america'
      ) ||
      sub.includes(
        'caribbean'
      ) ||
      country === 'mexico'
    ) {
      return 'latin_america';
    }

    if (
      sub.includes(
        'western europe'
      )
    ) {
      return 'western_europe';
    }

    if (
      sub.includes(
        'northern europe'
      )
    ) {
      return 'northern_europe';
    }

    if (
      sub.includes(
        'southern europe'
      )
    ) {
      return 'southern_europe';
    }

    if (
      sub.includes(
        'eastern europe'
      )
    ) {
      return 'eastern_europe';
    }

    if (
      sub.includes(
        'western asia'
      ) ||
      sub.includes(
        'northern africa'
      )
    ) {
      return 'middle_east_north_africa';
    }

    if (
      sub.includes('africa')
    ) {
      return 'sub_saharan_africa';
    }

    if (
      sub.includes(
        'southern asia'
      )
    ) {
      return 'south_asia';
    }

    if (
      sub.includes(
        'eastern asia'
      )
    ) {
      return 'east_asia';
    }

    if (
      sub.includes(
        'south-eastern asia'
      ) ||
      sub.includes(
        'southeastern asia'
      )
    ) {
      return 'southeast_asia';
    }

    if (
      sub.includes(
        'australia'
      ) ||
      sub.includes(
        'new zealand'
      ) ||
      sub.includes(
        'oceania'
      )
    ) {
      return 'oceania';
    }

    return normalizeText(trimmed)
      .replace(
        /[\s-]+/g,
        '_'
      );
  }

  function symmetricKey(
    a,
    b
  ) {
    return (
      String(a).localeCompare(
        String(b)
      ) <= 0
        ? `${a}|${b}`
        : `${b}|${a}`
    );
  }

  function lookupSymmetric(
    table,
    a,
    b
  ) {
    return (
      table[`${a}|${b}`] ??
      table[`${b}|${a}`]
    );
  }

  function compareCities(
    idA,
    idB
  ) {
    if (idA === idB) {
      return {
        overall: 1,
        coverage: 1,
        categories: {},
        fields: {}
      };
    }

    const cacheKey =
      symmetricKey(
        idA,
        idB
      );

    if (
      app.comparisonCache.has(
        cacheKey
      )
    ) {
      return (
        app.comparisonCache.get(
          cacheKey
        )
      );
    }

    const cityA =
      app.cityById.get(idA);

    const cityB =
      app.cityById.get(idB);

    if (
      !cityA ||
      !cityB
    ) {
      throw new Error(
        'compareCities received an unknown city ID.'
      );
    }

    const validCategories = [];
    const categories = {};
    const fields = {};

    for (
      const category of Object.keys(
        EXPECTED_SCHEMA
      )
    ) {
      const categoryCfg =
        app.weights
          .field_config[
            category
          ];

      const originalWeight =
        Object.values(
          categoryCfg
        ).reduce(
          (
            sum,
            cfg
          ) =>
            sum +
            cfg.weight,
          0
        );

      const validFields = [];
      let presentWeight = 0;

      for (
        const field of EXPECTED_SCHEMA[
          category
        ]
      ) {
        const a =
          comparisonValue(
            idA,
            cityA,
            category,
            field
          );

        const b =
          comparisonValue(
            idB,
            cityB,
            category,
            field
          );

        const cfg =
          categoryCfg[field];

        /*
         * Important:
         * missing data is skipped entirely.
         *
         * A real zero is NOT missing.
         *
         * The remaining valid fields are
         * renormalized below, so missing
         * data cannot behave like a zero.
         */
        if (
          isMissing(a) ||
          isMissing(b)
        ) {
          continue;
        }

        presentWeight +=
          cfg.weight;

        validFields.push({
          field,
          a,
          b,
          cfg
        });
      }

      const fieldCoverage =
        originalWeight > 0
          ? (
            presentWeight /
            originalWeight
          )
          : 0;

      if (
        fieldCoverage + 1e-12 <
          CATEGORY_MIN_FIELD_COVERAGE ||
        presentWeight <= 0
      ) {
        continue;
      }

      let categorySimilarity = 0;

      for (
        const item of validFields
      ) {
        const normalizedFieldWeight =
          item.cfg.weight /
          presentWeight;

        const similarity =
          compareField(
            item.a,
            item.b,
            item.cfg,
            category,
            item.field,
            idA,
            idB
          );

        categorySimilarity +=
          similarity *
          normalizedFieldWeight;

        fields[
          `${category}.${item.field}`
        ] = {
          similarity,
          normalizedFieldWeight,
          category
        };
      }

      categories[
        category
      ] = categorySimilarity;

      validCategories.push(
        category
      );
    }

    const representedCategoryWeight =
      validCategories.reduce(
        (
          sum,
          cat
        ) =>
          sum +
          app.weights
            .category_weights[
              cat
            ],
        0
      );

    let overall = 0;

    if (
      representedCategoryWeight > 0
    ) {
      for (
        const category of validCategories
      ) {
        const normalizedCategoryWeight =
          app.weights
            .category_weights[
              category
            ] /
          representedCategoryWeight;

        overall +=
          categories[
            category
          ] *
          normalizedCategoryWeight;

        for (
          const [
            path,
            result
          ] of Object.entries(fields)
        ) {
          if (
            result.category ===
            category
          ) {
            result.effectiveWeight =
              result.normalizedFieldWeight *
              normalizedCategoryWeight;
          }
        }
      }
    }

    const result = {
      overall:
        clamp01(overall),

      coverage:
        representedCategoryWeight,

      categories,
      fields
    };

    app.comparisonCache.set(
      cacheKey,
      result
    );

    return result;
  }

  function comparisonValue(
    id,
    city,
    category,
    field
  ) {
    const canonical =
      app.cityMeta
        .get(id)
        ?.canonical;

    if (
      category === 'environment' &&
      field === 'terrain_type'
    ) {
      return canonical.terrain;
    }

    if (
      category === 'environment' &&
      field === 'water_setting'
    ) {
      return canonical.water;
    }

    if (
      category === 'culture' &&
      field === 'cultural_region'
    ) {
      return canonical.cultural_region;
    }

    if (
      category === 'culture' &&
      field === 'primary_language'
    ) {
      return canonical.primary_language;
    }

    if (
      category === 'culture' &&
      field === 'secondary_language'
    ) {
      return canonical.secondary_language;
    }

    if (
      category === 'culture' &&
      field === 'language_family'
    ) {
      return canonical.language_family;
    }

    if (
      category === 'history' &&
      field === 'capital_status'
    ) {
      return canonical.capital_status;
    }

    if (
      category === 'history' &&
      field === 'historical_era'
    ) {
      return canonical.historical_era;
    }

    return city[
      category
    ][field];
  }

  function compareField(
    a,
    b,
    cfg,
    category,
    field,
    idA,
    idB
  ) {
    let score;

    switch (cfg.type) {
      case 'absolute_distance':
        score =
          Math.exp(
            -Math.abs(
              a - b
            ) /
            cfg.sensitivity
          );
        break;

      case 'percentage_distance':
        score =
          Math.max(
            0,
            1 -
            Math.abs(
              a - b
            ) /
            cfg.sensitivity
          );
        break;

      case 'log_ratio':
        score =
          Math.exp(
            -Math.abs(
              Math.log(
                1 +
                Math.max(
                  a,
                  0
                )
              ) -
              Math.log(
                1 +
                Math.max(
                  b,
                  0
                )
              )
            ) /
            cfg.sensitivity
          );
        break;

      case 'log_rank_distance':
        score =
          a > 0 &&
          b > 0
            ? Math.exp(
                -Math.abs(
                  Math.log(a) -
                  Math.log(b)
                ) /
                cfg.sensitivity
              )
            : 0;
        break;

      case 'boolean_match':
        score =
          a === b
            ? 1
            : cfg.mismatch_score;
        break;

      case 'koppen_hierarchy':
        score =
          koppenSimilarity(
            a,
            b
          );
        break;

      case 'similarity_matrix':
        score =
          matrixSimilarity(
            cfg.matrix,
            a,
            b,
            field,
            idA,
            idB
          );
        break;

      case 'historical_date_distance':
        score =
          historicalDateSimilarity(
            a,
            b
          );
        break;

      case 'historical_era':
        score =
          historicalEraSimilarity(
            a,
            b,
            field,
            idA,
            idB
          );
        break;

      case 'language_similarity':
        score =
          languageSimilarity(
            a,
            b,
            field,
            idA,
            idB
          );
        break;

      case 'language_family_hierarchy':
        score =
          languageFamilySimilarity(
            a,
            b,
            field,
            idA,
            idB
          );
        break;

      default:
        score = 0;
    }

    return clamp01(score);
  }

  function koppenSimilarity(
    a,
    b
  ) {
    const x =
      String(a).trim();

    const y =
      String(b).trim();

    if (x === y) {
      return 1;
    }

    if (
      x.slice(0, 2) ===
      y.slice(0, 2)
    ) {
      return 0.88;
    }

    if (
      x[0] === y[0]
    ) {
      return 0.68;
    }

    const related =
      lookupSymmetric(
        KOPPEN_RELATED,
        x[0],
        y[0]
      );

    return (
      related ??
      0.15
    );
  }

  function matrixSimilarity(
    matrix,
    a,
    b,
    field,
    idA,
    idB
  ) {
    if (a === b) {
      return 1;
    }

    const table =
      matrix === 'terrain'
        ? TERRAIN_SIMILARITY
        : matrix === 'water'
          ? WATER_SIMILARITY
          : matrix === 'capital_status'
            ? CAPITAL_STATUS_SIMILARITY
            : CULTURAL_REGION_SIMILARITY;

    const score =
      lookupSymmetric(
        table,
        a,
        b
      );

    if (
      score !== undefined
    ) {
      return score;
    }

    warnUnknown(
      field,
      a,
      b,
      idA,
      idB
    );

    return 0.1;
  }

  function historicalDateSimilarity(
    a,
    b
  ) {
    let sensitivity = 450;

    if (
      a < 0 &&
      b < 0
    ) {
      sensitivity = 1000;
    } else if (
      a >= 0 &&
      a <= 1499 &&
      b >= 0 &&
      b <= 1499
    ) {
      sensitivity = 700;
    } else if (
      a >= 1500 &&
      a <= 1849 &&
      b >= 1500 &&
      b <= 1849
    ) {
      sensitivity = 300;
    } else if (
      a >= 1850 &&
      b >= 1850
    ) {
      sensitivity = 120;
    }

    return Math.exp(
      -Math.abs(
        a - b
      ) /
      sensitivity
    );
  }

  function historicalEraSimilarity(
    a,
    b,
    field,
    idA,
    idB
  ) {
    if (a === b) {
      return 1;
    }

    const ia =
      HISTORICAL_ERAS.indexOf(a);

    const ib =
      HISTORICAL_ERAS.indexOf(b);

    if (
      ia === -1 ||
      ib === -1
    ) {
      warnUnknown(
        field,
        a,
        b,
        idA,
        idB
      );

      return 0.1;
    }

    return (
      HISTORICAL_ERA_SCORE[
        Math.abs(
          ia - ib
        )
      ] ??
      0.08
    );
  }

  function languageSimilarity(
    a,
    b,
    field,
    idA,
    idB
  ) {
    if (a === b) {
      return 1;
    }

    const override =
      lookupSymmetric(
        LANGUAGE_OVERRIDES,
        a,
        b
      );

    if (
      override !== undefined
    ) {
      return override;
    }

    const ia =
      app.languageIndex.get(a);

    const ib =
      app.languageIndex.get(b);

    if (
      ia &&
      ib &&
      ia.family === ib.family &&
      ia.branch === ib.branch
    ) {
      return 0.78;
    }

    if (
      ia &&
      ib &&
      ia.family === ib.family
    ) {
      return 0.55;
    }

    if (
      !ia ||
      !ib
    ) {
      warnUnknown(
        field,
        a,
        b,
        idA,
        idB
      );
    }

    return 0.12;
  }

  function languageFamilySimilarity(
    a,
    b,
    field,
    idA,
    idB
  ) {
    if (a === b) {
      return 1;
    }

    warnUnknown(
      field,
      a,
      b,
      idA,
      idB,
      true
    );

    return 0.10;
  }

  function warnUnknown(
    field,
    a,
    b,
    idA,
    idB,
    quiet = false
  ) {
    if (
      quiet &&
      !DEBUG
    ) {
      return;
    }

    const relationKey =
      `${field}|${symmetricKey(
        a,
        b
      )}`;

    if (
      app.warnedRelationships.has(
        relationKey
      )
    ) {
      return;
    }

    app.warnedRelationships.add(
      relationKey
    );

    const cityA =
      app.cityById
        .get(idA)
        ?.identity
        ?.city ||
      idA;

    const cityB =
      app.cityById
        .get(idB)
        ?.identity
        ?.city ||
      idB;

    console.warn(
      `Unknown categorical relationship for ${field}: "${a}" vs "${b}" (${cityA} / ${cityB}). Using fallback.`
    );
  }

  function clamp01(n) {
    return Math.min(
      1,
      Math.max(
        0,
        Number.isFinite(n)
          ? n
          : 0
      )
    );
  }

  function rankCandidates(
    seedAId,
    seedBId
  ) {
    const ranking = [];

    for (
      const candidateId of app.sortedIds
    ) {
      if (
        candidateId === seedAId ||
        candidateId === seedBId
      ) {
        continue;
      }

      const compA =
        compareCities(
          candidateId,
          seedAId
        );

      const compB =
        compareCities(
          candidateId,
          seedBId
        );

      if (
        compA.coverage + 1e-12 <
          MIN_COMPARISON_COVERAGE ||
        compB.coverage + 1e-12 <
          MIN_COMPARISON_COVERAGE
      ) {
        continue;
      }

      const similarityA =
        compA.overall;

      const similarityB =
        compB.overall;

      const combined =
        Math.sqrt(
          similarityA *
          similarityB
        );

      ranking.push({
        id:
          candidateId,

        similarityA,
        similarityB,
        combined,

        minSimilarity:
          Math.min(
            similarityA,
            similarityB
          ),

        arithmeticMean:
          (
            similarityA +
            similarityB
          ) /
          2
      });
    }

    ranking.sort(
      rankComparator
    );

    ranking.forEach(
      (
        entry,
        index
      ) => {
        entry.rank =
          index + 1;
      }
    );

    return ranking;
  }

  function rankComparator(
    a,
    b
  ) {
    if (
      Math.abs(
        a.combined -
        b.combined
      ) >=
      TIE_EPSILON
    ) {
      return (
        b.combined -
        a.combined
      );
    }

    if (
      Math.abs(
        a.minSimilarity -
        b.minSimilarity
      ) >=
      TIE_EPSILON
    ) {
      return (
        b.minSimilarity -
        a.minSimilarity
      );
    }

    if (
      Math.abs(
        a.arithmeticMean -
        b.arithmeticMean
      ) >=
      TIE_EPSILON
    ) {
      return (
        b.arithmeticMean -
        a.arithmeticMean
      );
    }

    return a.id.localeCompare(
      b.id
    );
  }

  function scoreForRank(
    rank,
    candidateCount
  ) {
    if (rank === 1) {
      return 1000;
    }

    if (
      candidateCount <= 1
    ) {
      return 0;
    }

    const percentile =
      1 -
      (
        (
          rank - 1
        ) /
        (
          candidateCount - 1
        )
      );

    return Math.max(
      0,
      Math.min(
        1000,
        Math.round(
          1000 *
          percentile *
          percentile
        )
      )
    );
  }

  function pairMetrics(
    seedAId,
    seedBId
  ) {
    const seedComp =
      compareCities(
        seedAId,
        seedBId
      );

    if (
      seedComp.coverage + 1e-12 <
      MIN_COMPARISON_COVERAGE
    ) {
      return null;
    }

    const ranking =
      rankCandidates(
        seedAId,
        seedBId
      );

    if (
      ranking.length < 10
    ) {
      return null;
    }

    const first =
      ranking[0];

    const second =
      ranking[1];

    const tenth =
      ranking[9];

    return {
      seedSimilarity:
        seedComp.overall,

      ranking,

      bestAnswerSimilarity:
        first.combined,

      firstSecondGap:
        first.combined -
        second.combined,

      firstTenthGap:
        first.combined -
        tenth.combined
    };
  }

  function passesQuality(
    m,
    level = 0
  ) {
    if (!m) {
      return false;
    }

    const relax = [
      {
        seedMin: 1,
        seedMax: 1,
        best: 1,
        gapMin: 1,
        gapMax: 1,
        tenth: 1
      },
      {
        seedMin: 0.80,
        seedMax: 1.10,
        best: 0.90,
        gapMin: 0.65,
        gapMax: 1.30,
        tenth: 0.75
      },
      {
        seedMin: 0.60,
        seedMax: 1.20,
        best: 0.80,
        gapMin: 0.40,
        gapMax: 1.70,
        tenth: 0.55
      }
    ][level];

    if (!relax) {
      return true;
    }

    const c =
      PUZZLE_GENERATION_CONFIG;

    return (
      m.seedSimilarity >=
        c.minSeedSimilarity *
        relax.seedMin &&

      m.seedSimilarity <=
        Math.min(
          1,
          c.maxSeedSimilarity *
          relax.seedMax
        ) &&

      m.bestAnswerSimilarity >=
        c.minBestAnswerSimilarity *
        relax.best &&

      m.firstSecondGap >=
        c.minFirstSecondGap *
        relax.gapMin &&

      m.firstSecondGap <=
        c.maxFirstSecondGap *
        relax.gapMax &&

      m.firstTenthGap >=
        c.minFirstTenthGap *
        relax.tenth
    );
  }

  function qualityPenalty(m) {
    const c =
      PUZZLE_GENERATION_CONFIG;

    const below = (
      value,
      min
    ) =>
      value >= min
        ? 0
        : (
          (
            min - value
          ) /
          Math.max(
            min,
            1e-12
          )
        );

    const above = (
      value,
      max
    ) =>
      value <= max
        ? 0
        : (
          (
            value - max
          ) /
          Math.max(
            1 - max,
            1e-12
          )
        );

    return (
      below(
        m.seedSimilarity,
        c.minSeedSimilarity
      ) +

      above(
        m.seedSimilarity,
        c.maxSeedSimilarity
      ) +

      below(
        m.bestAnswerSimilarity,
        c.minBestAnswerSimilarity
      ) +

      below(
        m.firstSecondGap,
        c.minFirstSecondGap
      ) +

      above(
        m.firstSecondGap,
        c.maxFirstSecondGap
      ) +

      below(
        m.firstTenthGap,
        c.minFirstTenthGap
      )
    );
  }

  function generateRoundPair(
    rng,
    usedSeedIds
  ) {
    const pool =
      app.sortedIds.filter(
        id =>
          !usedSeedIds.has(id)
      );

    if (
      pool.length < 2
    ) {
      throw new Error(
        'Not enough unused seed cities to generate all rounds.'
      );
    }

    const attempts = [];
    const seenPairs = new Set();

    for (
      let attempt = 0;
      attempt <
        PUZZLE_GENERATION_CONFIG
          .maxAttemptsPerRound;
      attempt++
    ) {
      const aIndex =
        Math.floor(
          rng() *
          pool.length
        );

      let bIndex =
        Math.floor(
          rng() *
          (
            pool.length - 1
          )
        );

      if (
        bIndex >= aIndex
      ) {
        bIndex += 1;
      }

      const seedAId =
        pool[aIndex];

      const seedBId =
        pool[bIndex];

      const pairKey =
        symmetricKey(
          seedAId,
          seedBId
        );

      if (
        seenPairs.has(
          pairKey
        )
      ) {
        continue;
      }

      seenPairs.add(
        pairKey
      );

      const metrics =
        pairMetrics(
          seedAId,
          seedBId
        );

      if (!metrics) {
        continue;
      }

      const candidate = {
        seedAId,
        seedBId,
        metrics,
        attempt
      };

      attempts.push(
        candidate
      );

      if (
        passesQuality(
          metrics,
          0
        )
      ) {
        return candidate;
      }
    }

    for (
      const level of [
        1,
        2
      ]
    ) {
      const match =
        attempts.find(
          item =>
            passesQuality(
              item.metrics,
              level
            )
        );

      if (match) {
        return match;
      }
    }

    if (
      attempts.length
    ) {
      return [
        ...attempts
      ].sort(
        (
          a,
          b
        ) =>
          qualityPenalty(
            a.metrics
          ) -
          qualityPenalty(
            b.metrics
          ) ||
          a.attempt -
          b.attempt
      )[0];
    }

    throw new Error(
      'Unable to generate a valid puzzle pair from this dataset.'
    );
  }

  function xmur3(str) {
    let h =
      1779033703 ^
      str.length;

    for (
      let i = 0;
      i < str.length;
      i++
    ) {
      h =
        Math.imul(
          h ^
          str.charCodeAt(i),
          3432918353
        );

      h =
        h << 13 |
        h >>> 19;
    }

    return function () {
      h =
        Math.imul(
          h ^
          (
            h >>> 16
          ),
          2246822507
        );

      h =
        Math.imul(
          h ^
          (
            h >>> 13
          ),
          3266489909
        );

      return (
        h ^=
        h >>> 16
      ) >>> 0;
    };
  }

  function mulberry32(a) {
    return function () {
      let t =
        a +=
        0x6D2B79F5;

      t =
        Math.imul(
          t ^
          t >>> 15,
          t | 1
        );

      t ^=
        t +
        Math.imul(
          t ^
          t >>> 7,
          t | 61
        );

      return (
        (
          t ^
          t >>> 14
        ) >>>
        0
      ) /
      4294967296;
    };
  }

  function seededRng(
    seedString
  ) {
    return mulberry32(
      xmur3(
        seedString
      )()
    );
  }

  function localDateKey(
    date = new Date()
  ) {
    const y =
      date.getFullYear();

    const m =
      String(
        date.getMonth() + 1
      ).padStart(
        2,
        '0'
      );

    const d =
      String(
        date.getDate()
      ).padStart(
        2,
        '0'
      );

    return `${y}-${m}-${d}`;
  }

  function randomSessionSeed() {
    if (
      globalThis.crypto
        ?.getRandomValues
    ) {
      const values =
        new Uint32Array(4);

      crypto.getRandomValues(
        values
      );

      return [
        ...values
      ].join('-');
    }

    return (
      `${Date.now()}-` +
      `${Math.random()}-` +
      `${performance.now()}`
    );
  }

  function generateSession(mode) {
    app.comparisonCache.clear();

    const dateKey =
      localDateKey();

    const sessionSeed =
      mode === 'daily'
        ? null
        : randomSessionSeed();

    const used =
      new Set();

    const rounds = [];

    for (
      let i = 0;
      i < ROUND_COUNT;
      i++
    ) {
      const seedString =
        mode === 'daily'
          ? (
            `${GAME_VERSION}|` +
            `${dateKey}|` +
            `${i + 1}`
          )
          : (
            `${GAME_VERSION}|` +
            `${sessionSeed}|` +
            `${i + 1}`
          );

      const chosen =
        generateRoundPair(
          seededRng(
            seedString
          ),
          used
        );

      used.add(
        chosen.seedAId
      );

      used.add(
        chosen.seedBId
      );

      rounds.push({
        seedAId:
          chosen.seedAId,

        seedBId:
          chosen.seedBId,

        ranking:
          chosen.metrics.ranking
      });
    }

    return {
      version:
        GAME_VERSION,

      mode,

      dateKey,

      sessionSeed,

      currentRound: 0,

      status:
        'playing',

      rounds,

      results:
        Array(
          ROUND_COUNT
        ).fill(null)
    };
  }

  function startMode(mode) {
    try {
      if (
        mode === 'daily'
      ) {
        const restored =
          restoreDaily();

        app.session =
          restored ||
          generateSession(
            'daily'
          );

        if (!restored) {
          persistDaily();
        }

      } else {
        app.session =
          generateSession(
            'infinite'
          );
      }

      if (
        app.session.status ===
        'final_results'
      ) {
        renderFinal();

      } else if (
        app.session.status ===
        'round_result'
      ) {
        renderRoundResult();

      } else {
        renderRound();
      }

    } catch (error) {
      console.error(error);

      showFatal(
        error instanceof Error
          ? error.message
          : String(error)
      );
    }
  }

  function dailyStorageKey(
    dateKey =
      localDateKey()
  ) {
    return (
      `city-link|` +
      `${GAME_VERSION}|` +
      `${dateKey}`
    );
  }

  function persistDaily() {
    if (
      !app.session ||
      app.session.mode !==
        'daily'
    ) {
      return;
    }

    const payload = {
      version:
        app.session.version,

      mode:
        'daily',

      dateKey:
        app.session.dateKey,

      currentRound:
        app.session.currentRound,

      status:
        app.session.status,

      rounds:
        app.session.rounds.map(
          r => ({
            seedAId:
              r.seedAId,

            seedBId:
              r.seedBId
          })
        ),

      results:
        app.session.results
    };

    try {
      localStorage.setItem(
        dailyStorageKey(
          app.session.dateKey
        ),
        JSON.stringify(
          payload
        )
      );

    } catch (error) {
      console.warn(
        'Could not persist Daily Game state.',
        error
      );
    }
  }

  function restoreDaily() {
    let raw;

    try {
      raw =
        localStorage.getItem(
          dailyStorageKey()
        );

    } catch {
      return null;
    }

    if (!raw) {
      return null;
    }

    try {
      const saved =
        JSON.parse(raw);

      if (
        saved.version !==
          GAME_VERSION ||
        saved.mode !==
          'daily' ||
        saved.dateKey !==
          localDateKey()
      ) {
        throw new Error(
          'Incompatible saved Daily state.'
        );
      }

      if (
        !Array.isArray(
          saved.rounds
        ) ||
        saved.rounds.length !==
          ROUND_COUNT ||
        !Array.isArray(
          saved.results
        ) ||
        saved.results.length !==
          ROUND_COUNT
      ) {
        throw new Error(
          'Malformed Daily state.'
        );
      }

      const rounds =
        saved.rounds.map(
          r => {
            if (
              !app.cityById.has(
                r.seedAId
              ) ||
              !app.cityById.has(
                r.seedBId
              ) ||
              r.seedAId ===
                r.seedBId
            ) {
              throw new Error(
                'Saved Daily state references invalid seed cities.'
              );
            }

            return {
              seedAId:
                r.seedAId,

              seedBId:
                r.seedBId,

              ranking:
                rankCandidates(
                  r.seedAId,
                  r.seedBId
                )
            };
          }
        );

      if (
        !Number.isInteger(
          saved.currentRound
        ) ||
        saved.currentRound < 0 ||
        saved.currentRound >=
          ROUND_COUNT
      ) {
        throw new Error(
          'Invalid saved round index.'
        );
      }

      if (
        ![
          'playing',
          'round_result',
          'final_results'
        ].includes(
          saved.status
        )
      ) {
        throw new Error(
          'Invalid saved session state.'
        );
      }

      for (
        const result of saved.results
      ) {
        if (
          result &&
          (
            !app.cityById.has(
              result.guessId
            ) ||
            typeof result.score !==
              'number'
          )
        ) {
          throw new Error(
            'Invalid saved result.'
          );
        }
      }

      return {
        ...saved,
        rounds
      };

    } catch (error) {
      console.warn(
        'Discarding malformed Daily Game state.',
        error
      );

      try {
        localStorage.removeItem(
          dailyStorageKey()
        );
      } catch {}

      return null;
    }
  }

  function renderWelcome() {
    hideAllScreens();

    dom.welcome.hidden =
      false;

    document.title =
      GAME_NAME;
  }

  function renderRound() {
    hideAllScreens();

    dom.game.hidden =
      false;

    app.session.status =
      'playing';

    resetInputState();
    updateRibbon();

    const round =
      currentRound();

    const seedA =
      app.cityById.get(
        round.seedAId
      );

    const seedB =
      app.cityById.get(
        round.seedBId
      );

    dom.gameCanvas.innerHTML = `
      <div class="round-shell">
        <div class="round-label">
          ROUND ${app.session.currentRound + 1}
        </div>

        <div class="seed-lockup">
          <div class="seed-place">
            <h2 class="seed-city">
              ${escapeHtml(seedA.identity.city)}
            </h2>
            <p class="seed-country">
              ${escapeHtml(seedA.identity.country)}
            </p>
          </div>

          <div
            class="seed-plus"
            aria-label="and"
          >
            +
          </div>

          <div class="seed-place seed-place-right">
            <h2 class="seed-city">
              ${escapeHtml(seedB.identity.city)}
            </h2>
            <p class="seed-country">
              ${escapeHtml(seedB.identity.country)}
            </p>
          </div>
        </div>

        <div class="answer-zone">
          <p class="answer-prompt">
            Which city is the best fusion?
          </p>

          <div class="input-wrap">
            <label
              class="sr-only"
              for="city-answer"
            >
              Type a city
            </label>

            <input
              id="city-answer"
              class="city-input"
              type="text"
              autocomplete="off"
              autocapitalize="words"
              spellcheck="false"
              placeholder="Type a city…"
              aria-describedby="input-status"
              aria-controls="suggestion-menu"
              aria-expanded="false"
            >

            <ul
              class="suggestion-menu"
              id="suggestion-menu"
              role="listbox"
              hidden
            ></ul>
          </div>

          <p
            class="input-status"
            id="input-status"
            aria-live="polite"
          ></p>
        </div>
      </div>
    `;

    bindRoundInput();

    dom.primaryControl.textContent =
      'Submit';

    dom.primaryControl.disabled =
      true;

    dom.primaryControl.dataset.action =
      'submit';

    if (
      app.session.mode ===
      'daily'
    ) {
      persistDaily();
    }

    queueMicrotask(
      () =>
        document
          .getElementById(
            'city-answer'
          )
          ?.focus()
    );
  }

  function bindRoundInput() {
    const input =
      document.getElementById(
        'city-answer'
      );

    input.addEventListener(
      'input',
      () => {
        app.inputState.resolvedId =
          null;

        closeSuggestionMenu();

        setInputStatus(
          '',
          ''
        );

        input.removeAttribute(
          'aria-invalid'
        );

        dom.primaryControl.disabled =
          !input.value.trim();
      }
    );

    input.addEventListener(
      'keydown',
      event => {
        if (
          app.inputState
            .suggestions
            .length
        ) {
          if (
            event.key ===
            'ArrowDown'
          ) {
            event.preventDefault();
            moveSuggestion(1);
            return;
          }

          if (
            event.key ===
            'ArrowUp'
          ) {
            event.preventDefault();
            moveSuggestion(-1);
            return;
          }

          if (
            event.key ===
            'Escape'
          ) {
            event.preventDefault();
            closeSuggestionMenu();
            return;
          }

          if (
            event.key ===
              'Enter' &&
            app.inputState
              .activeIndex >= 0
          ) {
            event.preventDefault();

            chooseSuggestion(
              app.inputState
                .activeIndex
            );

            return;
          }
        }

        if (
          event.key ===
          'Enter'
        ) {
          event.preventDefault();
          handlePrimaryControl();
        }
      }
    );
  }

  function handlePrimaryControl() {
    if (!app.session) {
      return;
    }

    if (
      app.session.status ===
      'round_result'
    ) {
      continueSession();
      return;
    }

    if (
      app.session.status !==
      'playing'
    ) {
      return;
    }

    resolveAndMaybeSubmit();
  }

  function resolveAndMaybeSubmit() {
    const input =
      document.getElementById(
        'city-answer'
      );

    if (
      !input ||
      !input.value.trim()
    ) {
      return;
    }

    if (
      app.inputState.resolvedId
    ) {
      submitResolvedGuess(
        app.inputState.resolvedId
      );

      return;
    }

    const raw =
      input.value.trim();

    const parsed =
      parseCityCountry(raw);

    const nameKey =
      normalizeText(
        parsed.city
      );

    let exactIds =
      app.nameIndex.has(
        nameKey
      )
        ? [
          ...app.nameIndex.get(
            nameKey
          )
        ]
        : [];

    if (
      parsed.country
    ) {
      exactIds =
        exactIds.filter(
          id =>
            app.cityMeta
              .get(id)
              .normalizedCountry ===
            normalizeText(
              parsed.country
            )
        );
    }

    if (
      exactIds.length === 1
    ) {
      submitResolvedGuess(
        exactIds[0]
      );

      return;
    }

    if (
      exactIds.length > 1
    ) {
      showSuggestions(
        exactIds,
        'disambiguation',
        `You entered “${parsed.city}”. Which one?`
      );

      return;
    }

    const fuzzy =
      fuzzyMatches(
        parsed.city,
        parsed.country
      );

    if (
      fuzzy.length
    ) {
      showSuggestions(
        fuzzy,
        'fuzzy',
        `No exact city named “${parsed.city}”. Did you mean?`
      );

      return;
    }

    input.setAttribute(
      'aria-invalid',
      'true'
    );

    setInputStatus(
      'City not found. Check the spelling and try again.',
      'error'
    );
  }

  function parseCityCountry(raw) {
    const comma =
      raw.indexOf(',');

    if (
      comma < 0
    ) {
      return {
        city:
          raw.trim(),

        country:
          ''
      };
    }

    return {
      city:
        raw
          .slice(
            0,
            comma
          )
          .trim(),

      country:
        raw
          .slice(
            comma + 1
          )
          .trim()
    };
  }

  function fuzzyMatches(
    cityText,
    countryText = ''
  ) {
    const input =
      normalizeText(
        cityText
      );

    if (!input) {
      return [];
    }

    const maxRaw =
      input.length <= 4
        ? 1
        : input.length <= 8
          ? 2
          : 3;

    const countryKey =
      normalizeText(
        countryText
      );

    const candidates = [];

    for (
      const id of app.sortedIds
    ) {
      const meta =
        app.cityMeta.get(id);

      if (
        countryKey &&
        meta.normalizedCountry !==
          countryKey
      ) {
        continue;
      }

      const distance =
        damerauLevenshtein(
          input,
          meta.normalizedName
        );

      const normalizedDistance =
        distance /
        Math.max(
          input.length,
          meta.normalizedName.length,
          1
        );

      if (
        distance <=
          maxRaw &&
        normalizedDistance <=
          0.30
      ) {
        const city =
          app.cityById.get(id);

        candidates.push({
          id,
          distance,
          normalizedDistance,

          city:
            city.identity.city,

          country:
            city.identity.country
        });
      }
    }

    candidates.sort(
      (
        a,
        b
      ) =>
        a.distance -
        b.distance ||

        a.normalizedDistance -
        b.normalizedDistance ||

        a.city.localeCompare(
          b.city
        ) ||

        a.country.localeCompare(
          b.country
        ) ||

        a.id.localeCompare(
          b.id
        )
    );

    return candidates
      .slice(
        0,
        5
      )
      .map(
        c => c.id
      );
  }

  function damerauLevenshtein(
    a,
    b
  ) {
    const n =
      a.length;

    const m =
      b.length;

    const d =
      Array.from(
        {
          length:
            n + 1
        },
        () =>
          Array(
            m + 1
          ).fill(0)
      );

    for (
      let i = 0;
      i <= n;
      i++
    ) {
      d[i][0] = i;
    }

    for (
      let j = 0;
      j <= m;
      j++
    ) {
      d[0][j] = j;
    }

    for (
      let i = 1;
      i <= n;
      i++
    ) {
      for (
        let j = 1;
        j <= m;
        j++
      ) {
        const cost =
          a[i - 1] ===
          b[j - 1]
            ? 0
            : 1;

        d[i][j] =
          Math.min(
            d[i - 1][j] + 1,
            d[i][j - 1] + 1,
            d[i - 1][j - 1] +
              cost
          );

        if (
          i > 1 &&
          j > 1 &&
          a[i - 1] ===
            b[j - 2] &&
          a[i - 2] ===
            b[j - 1]
        ) {
          d[i][j] =
            Math.min(
              d[i][j],
              d[i - 2][j - 2] + 1
            );
        }
      }
    }

    return d[n][m];
  }

  function showSuggestions(
    ids,
    type,
    message
  ) {
    const menu =
      document.getElementById(
        'suggestion-menu'
      );

    const input =
      document.getElementById(
        'city-answer'
      );

    app.inputState.suggestions =
      ids;

    app.inputState.activeIndex =
      -1;

    app.inputState.menuType =
      type;

    menu.innerHTML =
      ids.map(
        (
          id,
          index
        ) => {
          const city =
            app.cityById.get(id);

          const duplicateCountry =
            ids.filter(
              otherId =>
                app.cityById
                  .get(otherId)
                  .identity
                  .country ===
                city.identity.country
            ).length > 1;

          const suffix =
            duplicateCountry
              ? (
                ` — ` +
                `${
                  city.identity
                    .subregion ||
                  city.identity
                    .region
                }`
              )
              : '';

          return `
            <li
              role="option"
              id="suggestion-${index}"
              aria-selected="false"
            >
              <button
                type="button"
                class="suggestion-item"
                data-index="${index}"
              >
                ${escapeHtml(city.identity.city)},
                ${escapeHtml(city.identity.country)}
                ${escapeHtml(suffix)}
              </button>
            </li>
          `;
        }
      ).join('');

    menu.hidden =
      false;

    input.setAttribute(
      'aria-expanded',
      'true'
    );

    menu
      .querySelectorAll(
        '.suggestion-item'
      )
      .forEach(
        button =>
          button.addEventListener(
            'click',
            () =>
              chooseSuggestion(
                Number(
                  button.dataset
                    .index
                )
              )
          )
      );

    setInputStatus(
      message,
      ''
    );

    dom.primaryControl.disabled =
      true;
  }

  function chooseSuggestion(index) {
    const id =
      app.inputState
        .suggestions[
          index
        ];

    if (!id) {
      return;
    }

    const city =
      app.cityById.get(id);

    const input =
      document.getElementById(
        'city-answer'
      );

    app.inputState.resolvedId =
      id;

    input.value =
      `${city.identity.city}, ${city.identity.country}`;

    input.removeAttribute(
      'aria-invalid'
    );

    closeSuggestionMenu(
      false
    );

    const validation =
      validateGuess(id);

    if (
      !validation.ok
    ) {
      app.inputState.resolvedId =
        null;

      setInputStatus(
        validation.message,
        'error'
      );

      dom.primaryControl.disabled =
        false;

      return;
    }

    setInputStatus(
      `Ready: ${city.identity.city}, ${city.identity.country}. Press Submit to lock it in.`,
      'ready'
    );

    dom.primaryControl.disabled =
      false;

    input.focus();
  }

  function moveSuggestion(delta) {
    const count =
      app.inputState
        .suggestions
        .length;

    if (!count) {
      return;
    }

    app.inputState.activeIndex =
      (
        app.inputState
          .activeIndex +
        delta +
        count
      ) %
      count;

    const menu =
      document.getElementById(
        'suggestion-menu'
      );

    menu
      .querySelectorAll(
        '.suggestion-item'
      )
      .forEach(
        (
          el,
          i
        ) => {
          const active =
            i ===
            app.inputState
              .activeIndex;

          el.classList.toggle(
            'active',
            active
          );

          el.parentElement
            ?.setAttribute(
              'aria-selected',
              String(active)
            );

          if (active) {
            el.scrollIntoView({
              block:
                'nearest'
            });
          }
        }
      );

    document
      .getElementById(
        'city-answer'
      )
      ?.setAttribute(
        'aria-activedescendant',
        `suggestion-${app.inputState.activeIndex}`
      );
  }

  function closeSuggestionMenu(
    clear = true
  ) {
    const menu =
      document.getElementById(
        'suggestion-menu'
      );

    const input =
      document.getElementById(
        'city-answer'
      );

    if (menu) {
      menu.hidden =
        true;
    }

    if (input) {
      input.setAttribute(
        'aria-expanded',
        'false'
      );

      input.removeAttribute(
        'aria-activedescendant'
      );
    }

    /*
     * Both branches intentionally
     * clear suggestion state.
     */
    if (clear) {
      app.inputState.suggestions =
        [];

      app.inputState.activeIndex =
        -1;

      app.inputState.menuType =
        null;

    } else {
      app.inputState.suggestions =
        [];

      app.inputState.activeIndex =
        -1;

      app.inputState.menuType =
        null;
    }
  }

  function setInputStatus(
    message,
    type
  ) {
    const status =
      document.getElementById(
        'input-status'
      );

    if (!status) {
      return;
    }

    status.textContent =
      message;

    status.className =
      `input-status${
        type
          ? ` ${type}`
          : ''
      }`;
  }

  function validateGuess(id) {
    const round =
      currentRound();

    if (
      id === round.seedAId ||
      id === round.seedBId
    ) {
      return {
        ok: false,
        message:
          'Choose a third city.'
      };
    }

    if (
      !round.ranking.some(
        entry =>
          entry.id === id
      )
    ) {
      return {
        ok: false,
        message:
          "That city doesn't have enough data to score reliably. Try another city."
      };
    }

    return {
      ok: true
    };
  }

  function submitResolvedGuess(id) {
    const validation =
      validateGuess(id);

    if (
      !validation.ok
    ) {
      document
        .getElementById(
          'city-answer'
        )
        ?.setAttribute(
          'aria-invalid',
          'true'
        );

      setInputStatus(
        validation.message,
        'error'
      );

      return;
    }

    const result =
      buildRoundResult(
        currentRound(),
        id
      );

    app.session.results[
      app.session.currentRound
    ] = result;

    app.session.status =
      'round_result';

    persistDaily();
    renderRoundResult();
  }

  function buildRoundResult(
    round,
    guessId
  ) {
    const candidate =
      round.ranking.find(
        entry =>
          entry.id === guessId
      );

    if (!candidate) {
      throw new Error(
        'Submitted city is not in the candidate ranking.'
      );
    }

    const score =
      scoreForRank(
        candidate.rank,
        round.ranking.length
      );

    const explanation =
      buildExplanation(
        round,
        guessId
      );

    return {
      guessId,

      similarityA:
        candidate.similarityA,

      similarityB:
        candidate.similarityB,

      combined:
        candidate.combined,

      rank:
        candidate.rank,

      candidateCount:
        round.ranking.length,

      score,

      bestId:
        round.ranking[0].id,

      strongest:
        explanation.strongest,

      differences:
        explanation.differences
    };
  }

  function buildExplanation(
    round,
    guessId
  ) {
    const a =
      compareCities(
        guessId,
        round.seedAId
      );

    const b =
      compareCities(
        guessId,
        round.seedBId
      );

    const rows = [];

    for (
      const path of Object.keys(
        a.fields
      )
    ) {
      /*
       * Only display and calculate a
       * field here when it exists in
       * both pairwise comparisons.
       *
       * This means a missing field
       * can't accidentally appear as
       * zero in the explanation.
       */
      if (
        !b.fields[path]
      ) {
        continue;
      }

      const [
        category,
        field
      ] = path.split('.');

      const combinedSimilarity =
        Math.sqrt(
          a.fields[path].similarity *
          b.fields[path].similarity
        );

      const weight =
        Math.sqrt(
          (
            a.fields[path]
              .effectiveWeight ||
            0
          ) *
          (
            b.fields[path]
              .effectiveWeight ||
            0
          )
        );

      const guessValue =
        comparisonValue(
          guessId,
          app.cityById.get(
            guessId
          ),
          category,
          field
        );

      const seedAValue =
        comparisonValue(
          round.seedAId,
          app.cityById.get(
            round.seedAId
          ),
          category,
          field
        );

      const seedBValue =
        comparisonValue(
          round.seedBId,
          app.cityById.get(
            round.seedBId
          ),
          category,
          field
        );

      rows.push({
        path,
        category,
        field,

        label:
          FIELD_LABELS[field] ||
          humanize(field),

        similarity:
          combinedSimilarity,

        effectiveWeight:
          weight,

        contribution:
          combinedSimilarity *
          weight,

        guessValue,
        seedAValue,
        seedBValue
      });
    }

    const strongest =
      [
        ...rows
      ]
        .sort(
          (
            x,
            y
          ) =>
            y.contribution -
            x.contribution ||

            y.similarity -
            x.similarity ||

            x.path.localeCompare(
              y.path
            )
        )
        .slice(
          0,
          5
        );

    const differences =
      [
        ...rows
      ]
        .filter(
          r =>
            r.effectiveWeight >=
            0.005
        )
        .sort(
          (
            x,
            y
          ) =>
            x.similarity -
            y.similarity ||

            y.effectiveWeight -
            x.effectiveWeight ||

            x.path.localeCompare(
              y.path
            )
        )
        .slice(
          0,
          5
        );

    return {
      strongest,
      differences
    };
  }

  function renderRoundResult() {
    hideAllScreens();

    dom.game.hidden =
      false;

    updateRibbon();

    const round =
      currentRound();

    let result =
      app.session.results[
        app.session.currentRound
      ];

    if (!result) {
      app.session.status =
        'playing';

      renderRound();
      return;
    }

    /*
     * Refresh old persisted round
     * results if they predate the
     * detailed field-value output.
     */
    if (
      !result.strongest ||
      !result.differences
    ) {
      result =
        buildRoundResult(
          round,
          result.guessId
        );

      app.session.results[
        app.session.currentRound
      ] = result;

      persistDaily();
    }

    const guess =
      app.cityById.get(
        result.guessId
      );

    const seedA =
      app.cityById.get(
        round.seedAId
      );

    const seedB =
      app.cityById.get(
        round.seedBId
      );

    const best =
      app.cityById.get(
        result.bestId
      );

    dom.gameCanvas.innerHTML = `
      <div class="result-shell">

        <div class="result-top">
          <div>
            <p class="eyebrow">
              YOUR ANSWER
            </p>

            <h2 class="result-city">
              ${escapeHtml(guess.identity.city)}
            </h2>

            <p class="result-country">
              ${escapeHtml(guess.identity.country)}
            </p>
          </div>

          <div class="result-score-block">
            <p class="eyebrow">
              ROUND SCORE
            </p>

            <div class="result-score-big">
              <strong>
                ${result.score}
              </strong>
              <span>
                / 1000
              </span>
            </div>
          </div>
        </div>

        <div class="metric-grid">

          <div class="metric rank-metric">
            <div class="metric-label">
              Exact rank
            </div>
            <div class="metric-value">
              #${result.rank} of ${result.candidateCount}
            </div>
          </div>

          <div class="metric">
            <div class="metric-label">
              Similarity to
              ${escapeHtml(seedA.identity.city)}
            </div>
            <div class="metric-value">
              ${formatPct(result.similarityA)}
            </div>
          </div>

          <div class="metric">
            <div class="metric-label">
              Similarity to
              ${escapeHtml(seedB.identity.city)}
            </div>
            <div class="metric-value">
              ${formatPct(result.similarityB)}
            </div>
          </div>

          <div class="metric">
            <div class="metric-label">
              Combined similarity
            </div>
            <div class="metric-value">
              ${formatPct(result.combined, 1)}
            </div>
          </div>

        </div>

        <div class="explanation-grid">

          ${renderExplanationList(
            'Strongest similarities',
            result.strongest,
            seedA,
            seedB,
            guess
          )}

          ${renderExplanationList(
            'Weakest similarities',
            result.differences,
            seedA,
            seedB,
            guess
          )}

        </div>

        <div class="best-answer">
          <div>
            <p class="eyebrow">
              BEST POSSIBLE ANSWER
            </p>

            <p class="best-answer-name">
              ${escapeHtml(best.identity.city)},
              ${escapeHtml(best.identity.country)}
            </p>
          </div>
        </div>

      </div>
    `;

    dom.primaryControl.textContent =
      'Continue';

    dom.primaryControl.disabled =
      false;

    dom.primaryControl.dataset.action =
      'continue';
  }

  function renderExplanationList(
    title,
    rows,
    seedA,
    seedB,
    guess
  ) {
    return `
      <section class="explanation-list">

        <h3>
          ${escapeHtml(title)}
        </h3>

        <ol>

          ${
            rows.map(
              row => {
                const guessText =
                  formatFieldValue(
                    row.category,
                    row.field,
                    row.guessValue
                  );

                const seedAText =
                  formatFieldValue(
                    row.category,
                    row.field,
                    row.seedAValue
                  );

                const seedBText =
                  formatFieldValue(
                    row.category,
                    row.field,
                    row.seedBValue
                  );

                const titleText =
                  `${guess.identity.city}: ${guessText}; ` +
                  `${seedA.identity.city}: ${seedAText}; ` +
                  `${seedB.identity.city}: ${seedBText}`;

                return `
                  <li>

                    <span class="field-label">
                      ${escapeHtml(row.label)}
                    </span>

                    <span
                      class="field-comparison"
                      title="${escapeHtml(titleText)}"
                    >

                      <strong>
                        ${escapeHtml(guess.identity.city)}:
                        ${escapeHtml(guessText)}
                      </strong>

                      <span class="field-seeds">
                        ${escapeHtml(seedA.identity.city)}:
                        ${escapeHtml(seedAText)}
                        ·
                        ${escapeHtml(seedB.identity.city)}:
                        ${escapeHtml(seedBText)}
                      </span>

                    </span>

                  </li>
                `;
              }
            ).join('')
          }

        </ol>

      </section>
    `;
  }

  function formatFieldValue(
    category,
    field,
    value
  ) {
    if (
      isMissing(value)
    ) {
      return '—';
    }

    if (
      typeof value ===
      'boolean'
    ) {
      return value
        ? 'Yes'
        : 'No';
    }

    if (
      typeof value ===
      'string'
    ) {
      return humanize(
        value
      );
    }

    const n =
      Number(value);

    if (
      !Number.isFinite(n)
    ) {
      return '—';
    }

    const whole =
      new Intl.NumberFormat(
        undefined,
        {
          maximumFractionDigits:
            0
        }
      );

    const one =
      new Intl.NumberFormat(
        undefined,
        {
          maximumFractionDigits:
            1
        }
      );

    switch (field) {
      case 'latitude':
        return (
          `${one.format(
            Math.abs(n)
          )}° ` +
          `${
            n >= 0
              ? 'N'
              : 'S'
          }`
        );

      case 'elevation_m':
        return (
          `${whole.format(n)} m`
        );

      case 'avg_annual_temp_c':
      case 'avg_summer_high_c':
      case 'avg_winter_low_c':
        return (
          `${one.format(n)}°C`
        );

      case 'annual_precipitation_mm':
        return (
          `${whole.format(n)} mm`
        );

      case 'avg_relative_humidity_pct':
      case 'population_growth_rate_pct':
      case 'share_of_national_population_pct':
      case 'car_modal_share_pct':
      case 'transit_modal_share_pct':
      case 'walking_modal_share_pct':
      case 'cycling_modal_share_pct':
      case 'foreign_born_population_pct':
        return (
          `${one.format(n)}%`
        );

      case 'annual_sunshine_hours':
        return (
          `${whole.format(n)} h`
        );

      case 'distance_to_coast_km':
      case 'rapid_transit_network_km':
        return (
          `${whole.format(n)} km`
        );

      case 'city_population':
      case 'metro_population':
      case 'airport_passengers_annual':
      case 'international_tourist_arrivals_annual':
        return compactNumber(n);

      case 'metro_density_per_km2':
        return (
          `${whole.format(n)}/km²`
        );

      case 'metro_area_km2':
        return (
          `${whole.format(n)} km²`
        );

      case 'gdp_per_capita_usd':
        return (
          `$${compactNumber(n)}`
        );

      case 'metro_gdp_usd':
        return (
          `$${compactNumber(n)}`
        );

      case 'international_air_destinations':
        return whole.format(n);

      case 'founding_year':
        return n < 0
          ? (
            `${Math.abs(
              Math.round(n)
            )} BCE`
          )
          : (
            `${Math.round(n)} CE`
          );

      case 'national_city_rank':
        return (
          `#${whole.format(n)}`
        );

      default:
        return Number.isInteger(n)
          ? whole.format(n)
          : one.format(n);
    }
  }

  function compactNumber(value) {
    return new Intl.NumberFormat(
      undefined,
      {
        notation:
          'compact',

        maximumFractionDigits:
          1
      }
    ).format(value);
  }

  function continueSession() {
    if (
      app.session.currentRound >=
      ROUND_COUNT - 1
    ) {
      app.session.status =
        'final_results';

      persistDaily();
      renderFinal();

      return;
    }

    app.session.currentRound +=
      1;

    app.session.status =
      'playing';

    persistDaily();
    renderRound();
  }

  function renderFinal() {
    hideAllScreens();

    dom.final.hidden =
      false;

    app.session.status =
      'final_results';

    persistDaily();

    const total =
      totalScore();

    dom.finalMode.textContent =
      app.session.mode ===
      'daily'
        ? 'DAILY GAME'
        : 'INFINITE MODE';

    dom.finalDate.textContent =
      formatLongDate(
        app.session.dateKey
      );

    dom.finalTotalScore.textContent =
      `${total.toLocaleString()} / 5,000`;

    dom.finalRounds.innerHTML =
      app.session.rounds
        .map(
          (
            round,
            index
          ) => {
            const result =
              app.session.results[
                index
              ];

            const a =
              app.cityById.get(
                round.seedAId
              );

            const b =
              app.cityById.get(
                round.seedBId
              );

            const guess =
              result
                ? app.cityById.get(
                    result.guessId
                  )
                : null;

            const score =
              result?.score ||
              0;

            return `
              <div class="final-round-row">

                <div class="final-round-number">
                  ${
                    String(
                      index + 1
                    ).padStart(
                      2,
                      '0'
                    )
                  }
                </div>

                <div>
                  <div class="final-seeds">
                    ${escapeHtml(a.identity.city)}
                    +
                    ${escapeHtml(b.identity.city)}
                  </div>

                  <div class="final-guess">
                    ${
                      guess
                        ? (
                          `${escapeHtml(guess.identity.city)}, ` +
                          `${escapeHtml(guess.identity.country)}`
                        )
                        : '—'
                    }
                  </div>
                </div>

                <div class="final-score-strip-wrap">
                  <span class="score-strip">
                    ${scoreStrip(score)}
                  </span>
                </div>

                <div class="final-round-score">
                  ${score} / 1000
                </div>

              </div>
            `;
          }
        )
        .join('');

    dom.copyStatus.textContent =
      '';
  }

  function updateRibbon() {
    const total =
      totalScore();

    dom.cumulativeScore.textContent =
      String(total);

    dom.roundIndicator.textContent =
      `${app.session.currentRound + 1} / ${ROUND_COUNT}`;

    dom.ribbonDate.textContent =
      formatLongDate(
        app.session.dateKey
      );

    dom.progressSquares.innerHTML =
      Array.from(
        {
          length:
            ROUND_COUNT
        },
        (
          _,
          i
        ) => {
          const complete =
            Boolean(
              app.session.results[
                i
              ]
            );

          const current =
            i ===
              app.session.currentRound &&
            app.session.status !==
              'final_results';

          const classes = [
            'progress-square'
          ];

          if (complete) {
            classes.push(
              'complete'
            );
          }

          if (current) {
            classes.push(
              'current'
            );
          }

          if (
            current &&
            complete
          ) {
            classes.push(
              'submitted'
            );
          }

          return `
            <span
              class="${classes.join(' ')}"
              aria-label="Round ${i + 1}: ${
                complete
                  ? 'completed'
                  : current
                    ? 'current'
                    : 'unplayed'
              }"
            ></span>
          `;
        }
      ).join('');
  }

  function totalScore() {
    return app.session
      ? app.session.results.reduce(
          (
            sum,
            r
          ) =>
            sum +
            (
              r?.score ||
              0
            ),
          0
        )
      : 0;
  }

  function currentRound() {
    return (
      app.session.rounds[
        app.session.currentRound
      ]
    );
  }

  function resetInputState() {
    app.inputState = {
      resolvedId:
        null,

      suggestions:
        [],

      activeIndex:
        -1,

      menuType:
        null
    };
  }

  function scoreStrip(score) {
    const filled =
      Math.max(
        0,
        Math.min(
          10,
          Math.round(
            score /
            1000 *
            10
          )
        )
      );

    return (
      `${'█'.repeat(filled)}` +
      `${'░'.repeat(10 - filled)}`
    );
  }

  function clipboardText() {
    const prefix =
      app.session.mode ===
      'daily'
        ? (
          `${GAME_NAME} - ` +
          `${formatLongDate(app.session.dateKey)}:`
        )
        : (
          `${GAME_NAME} - Infinite Mode:`
        );

    const lines = [
      prefix
    ];

    app.session.results.forEach(
      (
        r,
        i
      ) => {
        const score =
          r?.score ||
          0;

        lines.push(
          `${i + 1}. ` +
          `${scoreStrip(score)} - ` +
          `${Math.round(score / 10)}%`
        );
      }
    );

    lines.push(
      `TOTAL: ${totalScore()}/5000`
    );

    return lines.join('\n');
  }

  async function copyScore() {
    const text =
      clipboardText();

    try {
      if (
        navigator.clipboard
          ?.writeText
      ) {
        await navigator.clipboard
          .writeText(text);

      } else {
        fallbackCopy(text);
      }

      dom.copyStatus.textContent =
        'Score copied.';

    } catch {
      try {
        fallbackCopy(text);

        dom.copyStatus.textContent =
          'Score copied.';

      } catch {
        dom.copyStatus.textContent =
          'Could not copy automatically. Select and copy the score manually.';
      }
    }
  }

  function fallbackCopy(text) {
    const area =
      document.createElement(
        'textarea'
      );

    area.value =
      text;

    area.setAttribute(
      'readonly',
      ''
    );

    area.style.position =
      'fixed';

    area.style.opacity =
      '0';

    document.body.appendChild(
      area
    );

    area.select();

    const ok =
      document.execCommand(
        'copy'
      );

    document.body.removeChild(
      area
    );

    if (!ok) {
      throw new Error(
        'Copy command failed.'
      );
    }
  }

  function formatPct(
    value,
    digits = 0
  ) {
    return (
      `${(
        value *
        100
      ).toFixed(digits)}%`
    );
  }

  function formatLongDate(
    dateKey
  ) {
    const [
      y,
      m,
      d
    ] =
      dateKey
        .split('-')
        .map(Number);

    return (
      new Intl.DateTimeFormat(
        undefined,
        {
          month:
            'long',

          day:
            'numeric',

          year:
            'numeric'
        }
      ).format(
        new Date(
          y,
          m - 1,
          d
        )
      )
    );
  }

  function humanize(value) {
    return String(value)
      .replace(
        /_/g,
        ' '
      )
      .replace(
        /\b\w/g,
        c =>
          c.toUpperCase()
      );
  }

  function escapeHtml(value) {
    return String(value)
      .replace(
        /[&<>'"]/g,
        ch => ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          "'": '&#39;',
          '"': '&quot;'
        })[ch]
      );
  }
})();
