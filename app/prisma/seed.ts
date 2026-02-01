import { PrismaClient, Region, BuildingCodeStatus, FindingCategory, CheckType, CodeRequirementStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Seed Building Codes
  // AU: 5 codes (NCC 2022, SI-01, SI-02, SI-03, BP-01)
  // UK: 1 code (Building Regs 2010)
  // US: 2 codes (IRC 2021, IBC 2021)

  const buildingCodes = await Promise.all([
    // Australian Codes
    prisma.buildingCode.upsert({
      where: { code_id: 'NCC-2022' },
      update: {},
      create: {
        region: Region.AU,
        code_id: 'NCC-2022',
        name: 'National Construction Code 2022',
        description: 'The National Construction Code (NCC) is Australia\'s primary set of technical design and construction provisions for buildings.',
        version: '2022',
        status: BuildingCodeStatus.ACTIVE,
        published_at: new Date('2022-05-01'),
      },
    }),
    prisma.buildingCode.upsert({
      where: { code_id: 'AS-SI-01' },
      update: {},
      create: {
        region: Region.AU,
        code_id: 'AS-SI-01',
        name: 'Structural Interpretations - Part 1',
        description: 'Australian Standards structural interpretations for residential buildings.',
        version: '2022',
        status: BuildingCodeStatus.ACTIVE,
        published_at: new Date('2022-01-01'),
      },
    }),
    prisma.buildingCode.upsert({
      where: { code_id: 'AS-SI-02' },
      update: {},
      create: {
        region: Region.AU,
        code_id: 'AS-SI-02',
        name: 'Structural Interpretations - Part 2',
        description: 'Australian Standards structural interpretations for commercial buildings.',
        version: '2022',
        status: BuildingCodeStatus.ACTIVE,
        published_at: new Date('2022-01-01'),
      },
    }),
    prisma.buildingCode.upsert({
      where: { code_id: 'AS-SI-03' },
      update: {},
      create: {
        region: Region.AU,
        code_id: 'AS-SI-03',
        name: 'Structural Interpretations - Part 3',
        description: 'Australian Standards structural interpretations for industrial buildings.',
        version: '2022',
        status: BuildingCodeStatus.ACTIVE,
        published_at: new Date('2022-01-01'),
      },
    }),
    prisma.buildingCode.upsert({
      where: { code_id: 'AS-BP-01' },
      update: {},
      create: {
        region: Region.AU,
        code_id: 'AS-BP-01',
        name: 'Building Performance - Part 1',
        description: 'Australian Standards building performance requirements.',
        version: '2022',
        status: BuildingCodeStatus.ACTIVE,
        published_at: new Date('2022-01-01'),
      },
    }),
    // UK Code
    prisma.buildingCode.upsert({
      where: { code_id: 'UK-BR-2010' },
      update: {},
      create: {
        region: Region.UK,
        code_id: 'UK-BR-2010',
        name: 'Building Regulations 2010',
        description: 'The Building Regulations 2010 set out minimum requirements for the design and construction of buildings in England and Wales.',
        version: '2010 (as amended)',
        status: BuildingCodeStatus.ACTIVE,
        published_at: new Date('2010-10-01'),
      },
    }),
    // US Codes
    prisma.buildingCode.upsert({
      where: { code_id: 'IRC-2021' },
      update: {},
      create: {
        region: Region.US,
        code_id: 'IRC-2021',
        name: 'International Residential Code 2021',
        description: 'The IRC is a comprehensive residential code that establishes minimum regulations for one- and two-family dwellings and townhouses.',
        version: '2021',
        status: BuildingCodeStatus.ACTIVE,
        published_at: new Date('2020-12-01'),
      },
    }),
    prisma.buildingCode.upsert({
      where: { code_id: 'IBC-2021' },
      update: {},
      create: {
        region: Region.US,
        code_id: 'IBC-2021',
        name: 'International Building Code 2021',
        description: 'The IBC is a model building code developed by the International Code Council for the construction of commercial and multi-family residential buildings.',
        version: '2021',
        status: BuildingCodeStatus.ACTIVE,
        published_at: new Date('2020-12-01'),
      },
    }),
  ]);

  console.log(`Seeded ${buildingCodes.length} building codes`);

  // Find the IRC-2021 code for requirements
  const irc2021 = buildingCodes.find(c => c.code_id === 'IRC-2021');
  if (!irc2021) {
    throw new Error('IRC-2021 not found');
  }

  // Seed CodeRequirement records for IRC 2021
  // 10+ requirements across multiple categories
  const codeRequirements = await Promise.all([
    // STRUCTURAL requirements
    prisma.codeRequirement.upsert({
      where: { id: '00000000-0000-0000-0001-000000000001' },
      update: {},
      create: {
        id: '00000000-0000-0000-0001-000000000001',
        building_code_id: irc2021.id,
        code_ref: 'R301.1',
        title: 'Application',
        category: FindingCategory.STRUCTURAL,
        full_text: 'Buildings and structures, and parts thereof, shall be constructed to safely support all loads, including dead loads, live loads, roof loads, flood loads, snow loads, wind loads and seismic loads as prescribed by this code.',
        check_type: CheckType.PRESENCE_CHECK,
        thresholds: {},
        applies_to_drawing_types: ['floor_plan', 'section', 'elevation'],
        applies_to_building_types: ['residential', 'single_family', 'townhouse'],
        applies_to_spaces: ['all'],
        exceptions: [],
        extraction_guidance: 'Look for structural load specifications, load tables, or notes indicating design loads on structural drawings. Check for references to wind zones, seismic categories, or snow load regions.',
        evaluation_guidance: 'Verify that the drawings reference or show compliance with applicable load requirements. Look for structural notes, load diagrams, or specifications that address dead, live, roof, and environmental loads.',
        source_page: 35,
        status: CodeRequirementStatus.PUBLISHED,
      },
    }),
    prisma.codeRequirement.upsert({
      where: { id: '00000000-0000-0000-0001-000000000002' },
      update: {},
      create: {
        id: '00000000-0000-0000-0001-000000000002',
        building_code_id: irc2021.id,
        code_ref: 'R301.2.1',
        title: 'Wind Design Criteria',
        category: FindingCategory.STRUCTURAL,
        full_text: 'Buildings and portions thereof shall be constructed in accordance with the wind provisions of this code using the ultimate design wind speed (Vult) as determined from Figure R301.2(5)A.',
        check_type: CheckType.MEASUREMENT_THRESHOLD,
        thresholds: { min_wind_speed: 115, max_wind_speed: 180, unit: 'mph' },
        applies_to_drawing_types: ['floor_plan', 'section', 'elevation', 'site_plan'],
        applies_to_building_types: ['residential', 'single_family', 'townhouse'],
        applies_to_spaces: ['all'],
        exceptions: ['Buildings in special wind regions require local authority approval'],
        extraction_guidance: 'Extract the design wind speed from structural notes, title block information, or site plan. Look for "Vult", "ultimate wind speed", or "design wind speed" values in mph.',
        evaluation_guidance: 'Compare the specified design wind speed against the required range of 115-180 mph. Verify the wind speed is appropriate for the project location per Figure R301.2(5)A.',
        source_page: 38,
        status: CodeRequirementStatus.PUBLISHED,
      },
    }),
    prisma.codeRequirement.upsert({
      where: { id: '00000000-0000-0000-0001-000000000003' },
      update: {},
      create: {
        id: '00000000-0000-0000-0001-000000000003',
        building_code_id: irc2021.id,
        code_ref: 'R302.1',
        title: 'Exterior Walls - Fire Separation Distance',
        category: FindingCategory.FIRE_SAFETY,
        full_text: 'Construction, projections, openings and penetrations of exterior walls of dwellings and accessory buildings shall comply with Table R302.1(1) and Table R302.1(2).',
        check_type: CheckType.MEASUREMENT_THRESHOLD,
        thresholds: { min_separation: 3, unit: 'feet' },
        applies_to_drawing_types: ['site_plan', 'floor_plan', 'elevation'],
        applies_to_building_types: ['residential', 'single_family', 'townhouse', 'accessory'],
        applies_to_spaces: ['exterior'],
        exceptions: ['Detached garages more than 3 feet from property line with 1-hour fire-rated wall'],
        extraction_guidance: 'Measure the distance from exterior walls to property lines on site plans. Look for setback dimensions, property line locations, and fire-rated wall notations.',
        evaluation_guidance: 'Verify exterior walls are at least 3 feet from property lines OR have appropriate fire-rated construction per Table R302.1(1). Check opening percentages comply with separation distance.',
        source_page: 52,
        status: CodeRequirementStatus.PUBLISHED,
      },
    }),
    // FIRE_SAFETY requirements
    prisma.codeRequirement.upsert({
      where: { id: '00000000-0000-0000-0001-000000000004' },
      update: {},
      create: {
        id: '00000000-0000-0000-0001-000000000004',
        building_code_id: irc2021.id,
        code_ref: 'R302.5',
        title: 'Dwelling/Garage Opening Protection',
        category: FindingCategory.FIRE_SAFETY,
        full_text: 'Openings from a private garage directly into a room used for sleeping purposes shall not be permitted. Other openings between the garage and residence shall be equipped with solid wood doors not less than 1 3/8 inches in thickness, solid or honeycomb-core steel doors not less than 1 3/8 inches thick, or 20-minute fire-rated doors.',
        check_type: CheckType.PRESENCE_CHECK,
        thresholds: { min_door_thickness: 1.375, unit: 'inches' },
        applies_to_drawing_types: ['floor_plan', 'section', 'detail'],
        applies_to_building_types: ['residential', 'single_family', 'townhouse'],
        applies_to_spaces: ['garage', 'corridor', 'living_space'],
        exceptions: ['Doors equipped with self-closing devices'],
        extraction_guidance: 'Identify all door openings between garage and dwelling spaces. Look for door schedules, door type notations, and fire rating labels. Check if any doors open directly to bedrooms.',
        evaluation_guidance: 'Confirm no garage doors open to bedrooms. Verify all garage-to-dwelling doors are 1-3/8" solid wood, 1-3/8" steel, or 20-minute rated. Check for self-closing device requirements.',
        source_page: 55,
        status: CodeRequirementStatus.PUBLISHED,
      },
    }),
    prisma.codeRequirement.upsert({
      where: { id: '00000000-0000-0000-0001-000000000005' },
      update: {},
      create: {
        id: '00000000-0000-0000-0001-000000000005',
        building_code_id: irc2021.id,
        code_ref: 'R314.3',
        title: 'Smoke Alarm Location',
        category: FindingCategory.FIRE_SAFETY,
        full_text: 'Smoke alarms shall be installed in the following locations: In each sleeping room, outside each separate sleeping area in the immediate vicinity of the bedrooms, on each additional story of the dwelling.',
        check_type: CheckType.PRESENCE_CHECK,
        thresholds: {},
        applies_to_drawing_types: ['floor_plan', 'electrical'],
        applies_to_building_types: ['residential', 'single_family', 'townhouse'],
        applies_to_spaces: ['bedroom', 'hallway', 'stairway'],
        exceptions: ['Existing dwellings undergoing alterations may comply with R314.3.1'],
        extraction_guidance: 'Look for smoke alarm symbols (usually circular with "S" or "SM" notation) on floor plans and electrical plans. Count alarms per bedroom and per floor level.',
        evaluation_guidance: 'Verify smoke alarm shown in each bedroom, in hallway outside each sleeping area, and on each floor including basement. Check interconnection requirements.',
        source_page: 78,
        status: CodeRequirementStatus.PUBLISHED,
      },
    }),
    // EGRESS requirements
    prisma.codeRequirement.upsert({
      where: { id: '00000000-0000-0000-0001-000000000006' },
      update: {},
      create: {
        id: '00000000-0000-0000-0001-000000000006',
        building_code_id: irc2021.id,
        code_ref: 'R310.1',
        title: 'Emergency Escape and Rescue Openings Required',
        category: FindingCategory.EGRESS,
        full_text: 'Basements, habitable attics and every sleeping room shall have at least one operable emergency escape and rescue opening. Such opening shall open directly into a public way, or to a yard or court that opens to a public way.',
        check_type: CheckType.PRESENCE_CHECK,
        thresholds: { min_net_clear_opening: 5.7, unit: 'sq_ft' },
        applies_to_drawing_types: ['floor_plan', 'elevation', 'section'],
        applies_to_building_types: ['residential', 'single_family', 'townhouse'],
        applies_to_spaces: ['bedroom', 'basement', 'habitable_attic'],
        exceptions: ['Storm shelters and safe rooms complying with ICC 500'],
        extraction_guidance: 'Identify all bedrooms, basements, and habitable attics. Look for window schedules showing egress-compliant windows (marked "EG" or "egress"). Measure window clear opening dimensions.',
        evaluation_guidance: 'Verify each bedroom has at least one egress window with minimum 5.7 sq ft net clear opening (5.0 sq ft at grade). Check minimum width of 20" and height of 24".',
        source_page: 70,
        status: CodeRequirementStatus.PUBLISHED,
      },
    }),
    prisma.codeRequirement.upsert({
      where: { id: '00000000-0000-0000-0001-000000000007' },
      update: {},
      create: {
        id: '00000000-0000-0000-0001-000000000007',
        building_code_id: irc2021.id,
        code_ref: 'R311.7.5.1',
        title: 'Stair Riser Height',
        category: FindingCategory.EGRESS,
        full_text: 'The maximum riser height shall be 7 3/4 inches. The riser shall be measured vertically between leading edges of the adjacent treads.',
        check_type: CheckType.MEASUREMENT_THRESHOLD,
        thresholds: { max_riser_height: 7.75, unit: 'inches' },
        applies_to_drawing_types: ['section', 'detail', 'floor_plan'],
        applies_to_building_types: ['residential', 'single_family', 'townhouse'],
        applies_to_spaces: ['stairway'],
        exceptions: ['Spiral stairways per R311.7.10.1', 'Winders per R311.7.5.3'],
        extraction_guidance: 'Find stair sections or details showing riser dimensions. Look for riser height annotations, stair schedules, or typical stair detail drawings. Extract the specified riser height.',
        evaluation_guidance: 'Compare the specified riser height against the 7-3/4" maximum. Verify consistency of riser heights throughout the stair (max 3/8" variation between risers).',
        source_page: 88,
        status: CodeRequirementStatus.PUBLISHED,
      },
    }),
    // ACCESSIBILITY requirements
    prisma.codeRequirement.upsert({
      where: { id: '00000000-0000-0000-0001-000000000008' },
      update: {},
      create: {
        id: '00000000-0000-0000-0001-000000000008',
        building_code_id: irc2021.id,
        code_ref: 'R311.3.2',
        title: 'Floor Elevation at Exterior Doors',
        category: FindingCategory.ACCESSIBILITY,
        full_text: 'Exterior landings shall have a minimum dimension of 36 inches measured in the direction of travel. The floor or landing at the exit door required by Section R311.2 shall not be more than 1 1/2 inches lower than the top of the threshold.',
        check_type: CheckType.MEASUREMENT_THRESHOLD,
        thresholds: { max_threshold_height: 1.5, min_landing_depth: 36, unit: 'inches' },
        applies_to_drawing_types: ['floor_plan', 'section', 'detail'],
        applies_to_building_types: ['residential', 'single_family', 'townhouse'],
        applies_to_spaces: ['entry', 'exterior'],
        exceptions: ['Doors other than the exit door required by R311.2'],
        extraction_guidance: 'Locate exterior doors on floor plans. Find door threshold details or sections showing floor elevation relationships. Measure landing dimensions at exit doors.',
        evaluation_guidance: 'Verify the main exit door has landing at least 36" deep and floor not more than 1.5" below threshold top. Check other exterior doors for landing dimensions.',
        source_page: 85,
        status: CodeRequirementStatus.PUBLISHED,
      },
    }),
    // ENERGY requirements
    prisma.codeRequirement.upsert({
      where: { id: '00000000-0000-0000-0001-000000000009' },
      update: {},
      create: {
        id: '00000000-0000-0000-0001-000000000009',
        building_code_id: irc2021.id,
        code_ref: 'N1102.1',
        title: 'Building Thermal Envelope Insulation',
        category: FindingCategory.ENERGY,
        full_text: 'The building thermal envelope shall meet the requirements of Table N1102.1.2 based on the climate zone specified in Figure N1101.7 and Table N1101.7.',
        check_type: CheckType.MEASUREMENT_THRESHOLD,
        thresholds: { min_ceiling_r: 38, min_wall_r: 13, min_floor_r: 19, unit: 'R-value' },
        applies_to_drawing_types: ['section', 'detail', 'schedule'],
        applies_to_building_types: ['residential', 'single_family', 'townhouse'],
        applies_to_spaces: ['all'],
        exceptions: ['Mass walls per Table N1102.1.2', 'Steel-framed walls with adjusted R-values'],
        extraction_guidance: 'Find wall section details, insulation schedules, or specification notes. Extract R-values for ceilings, walls, and floors. Identify the climate zone from site information or notes.',
        evaluation_guidance: 'Compare specified R-values against Table N1102.1.2 requirements for the applicable climate zone. Verify ceiling R-38+, wall R-13+, floor R-19+ for typical zones.',
        source_page: 432,
        status: CodeRequirementStatus.PUBLISHED,
      },
    }),
    // GENERAL_BUILDING requirements
    prisma.codeRequirement.upsert({
      where: { id: '00000000-0000-0000-0001-000000000010' },
      update: {},
      create: {
        id: '00000000-0000-0000-0001-000000000010',
        building_code_id: irc2021.id,
        code_ref: 'R304.1',
        title: 'Minimum Room Areas',
        category: FindingCategory.GENERAL_BUILDING,
        full_text: 'Every dwelling unit shall have at least one habitable room that shall have not less than 120 square feet of gross floor area. Other habitable rooms shall have a floor area of not less than 70 square feet.',
        check_type: CheckType.MEASUREMENT_THRESHOLD,
        thresholds: { min_primary_room: 120, min_other_rooms: 70, unit: 'sq_ft' },
        applies_to_drawing_types: ['floor_plan'],
        applies_to_building_types: ['residential', 'single_family', 'townhouse'],
        applies_to_spaces: ['living_room', 'bedroom', 'dining_room'],
        exceptions: ['Kitchens are not required to meet minimum area requirements'],
        extraction_guidance: 'Measure room areas from floor plans. Look for room labels with square footage annotations. Calculate areas for living rooms, bedrooms, and other habitable spaces.',
        evaluation_guidance: 'Verify at least one room is 120 sq ft or larger. Check all other habitable rooms are at least 70 sq ft. Kitchens excluded from this requirement.',
        source_page: 60,
        status: CodeRequirementStatus.PUBLISHED,
      },
    }),
    prisma.codeRequirement.upsert({
      where: { id: '00000000-0000-0000-0001-000000000011' },
      update: {},
      create: {
        id: '00000000-0000-0000-0001-000000000011',
        building_code_id: irc2021.id,
        code_ref: 'R305.1',
        title: 'Minimum Ceiling Height',
        category: FindingCategory.GENERAL_BUILDING,
        full_text: 'Habitable space, hallways and portions of basements containing these spaces shall have a ceiling height of not less than 7 feet.',
        check_type: CheckType.MEASUREMENT_THRESHOLD,
        thresholds: { min_ceiling_height: 7, unit: 'feet' },
        applies_to_drawing_types: ['section', 'elevation', 'floor_plan'],
        applies_to_building_types: ['residential', 'single_family', 'townhouse'],
        applies_to_spaces: ['living_room', 'bedroom', 'hallway', 'basement'],
        exceptions: ['Beams, girders, and ducts may project to 6 feet 4 inches from the floor', 'Bathrooms may have 6 feet 8 inches ceiling height'],
        extraction_guidance: 'Find ceiling heights on building sections or interior elevations. Look for floor-to-ceiling dimensions, ceiling height notes, or room height annotations on floor plans.',
        evaluation_guidance: 'Verify all habitable spaces show ceiling height of 7 feet or greater. Check bathroom and beam clearance exceptions where applicable.',
        source_page: 62,
        status: CodeRequirementStatus.PUBLISHED,
      },
    }),
    // PLUMBING requirement
    prisma.codeRequirement.upsert({
      where: { id: '00000000-0000-0000-0001-000000000012' },
      update: {},
      create: {
        id: '00000000-0000-0000-0001-000000000012',
        building_code_id: irc2021.id,
        code_ref: 'P2903.1',
        title: 'Water Supply System Design',
        category: FindingCategory.PLUMBING,
        full_text: 'The design of the water supply system shall conform to accepted engineering practice. Methods utilized to determine pipe sizes shall be approved.',
        check_type: CheckType.PRESENCE_CHECK,
        thresholds: {},
        applies_to_drawing_types: ['floor_plan', 'detail'],
        applies_to_building_types: ['residential', 'single_family', 'townhouse'],
        applies_to_spaces: ['bathroom', 'kitchen', 'laundry', 'utility'],
        exceptions: [],
        extraction_guidance: 'Look for plumbing plans or fixture schedules. Identify water supply line sizes, fixture unit counts, and water heater specifications. Check for plumbing notes or specifications.',
        evaluation_guidance: 'Verify water supply design is documented with pipe sizes and fixture connections. Check that design follows accepted engineering practice with appropriate sizing methods.',
        source_page: 520,
        status: CodeRequirementStatus.PUBLISHED,
      },
    }),
  ]);

  console.log(`Seeded ${codeRequirements.length} code requirements for IRC 2021`);

  console.log('Seeding complete!');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
