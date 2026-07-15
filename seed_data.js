/**
 * seed_data.js — Load Historical Measurements
 *
 * HOW TO USE:
 *   1. Open index.html in your browser
 *   2. Complete onboarding (if not done) so your profile exists
 *   3. Open browser DevTools → Console (F12)
 *   4. Type: loadHistoricalData()  and press Enter
 *   5. The page will refresh automatically with all 10 entries loaded
 *
 * SAFE TO RUN MULTIPLE TIMES — checks for duplicate dates before adding.
 */
function loadHistoricalData() {
  if (typeof StorageService === 'undefined') {
    console.error('❌ StorageService not found. Make sure index.html is open.');
    return;
  }

  const historicalEntries = [
    {
      date: '2025-08-04', weight: 77.43, neck: 32, chest: 94,
      waist: 75,   hips: 110,   thigh: 68,   arm: 32,   calf: 39.5,
    },
    {
      date: '2025-08-11', weight: 77.43, neck: 32, chest: 97,
      waist: 74.5, hips: 108,   thigh: 65.5, arm: 30.5, calf: 39.5,
    },
    {
      date: '2025-08-22', weight: 77.43, neck: 32, chest: 97,
      waist: 76,   hips: 107.5, thigh: 66,   arm: 31.5, calf: 39,
    },
    {
      date: '2025-09-01', weight: 77.0,  neck: 32, chest: 98,
      waist: 76,   hips: 109,   thigh: 65,   arm: 31,   calf: 40,
    },
    {
      date: '2025-09-07', weight: 77.0,  neck: 32, chest: 95,
      waist: 76,   hips: 108,   thigh: 66,   arm: 30,   calf: 39.5,
    },
    {
      date: '2025-09-15', weight: 77.0,  neck: 32, chest: 97,
      waist: 77,   hips: 109,   thigh: 67,   arm: 30.5, calf: 39.5,
    },
    {
      date: '2025-11-01', weight: 74.83, neck: 32, chest: 96,
      waist: 75.5, hips: 108,   thigh: 64.5, arm: 30.5, calf: 38.5,
    },
    {
      date: '2025-12-01', weight: 73.68, neck: 32, chest: 94,
      waist: 74,   hips: 106,   thigh: 63,   arm: 29,   calf: 38,
    },
    {
      date: '2026-05-01', weight: 73.27, neck: 32, chest: 92,
      waist: 74,   hips: 105,   thigh: 63,   arm: 29.5, calf: 38.5,
    },
    {
      date: '2026-06-01', weight: 71.87, neck: 32, chest: 91.5,
      waist: 73,   hips: 104.5, thigh: 61.5, arm: 29.5, calf: 38,
    },
  ];

  // Get existing dates to avoid duplicates
  const existingDates = new Set(StorageService.getEntries().map(e => e.date));

  let added   = 0;
  let skipped = 0;

  historicalEntries.forEach(entry => {
    if (existingDates.has(entry.date)) {
      console.log(`⏭ Skipped (already exists): ${entry.date}`);
      skipped++;
    } else {
      StorageService.addEntry(entry);
      console.log(`✅ Added: ${entry.date} — Weight: ${entry.weight} kg`);
      added++;
    }
  });

  console.log(`\n📊 Done! Added: ${added} | Skipped: ${skipped}`);
  if (added > 0) {
    console.log('🔄 Reloading page to show new data...');
    setTimeout(() => location.reload(), 600);
  }
}

// Auto-run when the script loads
setTimeout(loadHistoricalData, 500);
