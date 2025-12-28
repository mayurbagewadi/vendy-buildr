# 🧪 Commission Settings - Manual Testing Guide

## ✅ All Bugs Fixed and Ready to Test!

**Dev Server:** http://localhost:8080
**Page:** Commission Settings (Superadmin Panel)

---

## 📋 PRE-TEST CHECKLIST

Before starting, ensure:
- [ ] Dev server is running (`npm run dev`)
- [ ] You're logged in as superadmin
- [ ] Browser console is open (F12)
- [ ] Network tab is open to see API calls

---

## 🔧 TEST 1: Bug #1 Fix - Yearly Commission Inputs

**What was broken:** Changing yearly commission values crashed with "setStoreYearlyOnetimeValue is not defined"
**What was fixed:** Updated to use correct `setNetworkYearly` function

### Steps:
1. Navigate to Commission Settings page
2. Scroll to "Network Commission Settings" card
3. Click **"Yearly Subscription"** tab
4. Under "Commission Model", select **"Model 1: One-time Commission Only"**
5. Try changing the **"Rate (%)"** value (e.g., type `15`)

### Expected Results:
- ✅ Value changes without errors
- ✅ No console errors
- ✅ Input field updates smoothly

6. Select **"Model 2: Recurring Commission Only"**
7. Try changing the **recurring "Rate (%)"** value (e.g., type `10`)

### Expected Results:
- ✅ Value changes without errors
- ✅ No console errors

### ❌ Before Fix:
- Console error: `ReferenceError: setStoreYearlyOnetimeValue is not defined`
- Page would crash

---

## 🔧 TEST 2: Bug #2 Fix - Audit Trail Loading

**What was broken:** Audit trail queried wrong table name (`commission_settings_audit` instead of `commission_audit`)
**What was fixed:** Corrected table name to `commission_audit`

### Steps:
1. On Commission Settings page
2. Scroll to bottom
3. Click **"Show History"** button

### Expected Results:
- ✅ No console errors
- ✅ Either shows audit records OR shows "No audit records yet"
- ✅ Check browser console - should see successful Supabase query
- ✅ No "table does not exist" errors

### ❌ Before Fix:
- Console error: `relation "commission_settings_audit" does not exist`
- Audit trail always empty

---

## 🔧 TEST 3: Issue #3 Fix - Database Save/Load

**What was broken:** Settings were simulated, not actually saved to database
**What was fixed:** Full database integration implemented

### Test 3A: Load Settings from Database

#### Steps:
1. Open Commission Settings page
2. Check browser console
3. Look for Supabase queries

#### Expected Results:
- ✅ See query to `commission_settings` table
- ✅ See query to `network_commission` table
- ✅ See query to `subscription_plans` table
- ✅ Form fields populate with database values
- ✅ Toast message: "Settings loaded successfully"

### Test 3B: Save Settings to Database

#### Steps:
1. Make some changes:
   - Change Network Monthly one-time commission to `20%`
   - Change payment threshold to `1000`
   - Toggle one of the feature switches
2. Click **"Save All Settings"** button
3. Watch the browser console

#### Expected Results:
- ✅ See `INSERT` queries to database
- ✅ Success toast shows version number: "Settings saved successfully! (Version X)"
- ✅ No errors in console
- ✅ Saving indicator shows briefly

4. **Refresh the page** (F5)

#### Expected Results:
- ✅ Your changes are still there (not lost)
- ✅ Settings loaded from database
- ✅ All values match what you saved

### Test 3C: Settings Versioning

#### Steps:
1. Change a setting
2. Click "Save All Settings"
3. Note the version number (e.g., "Version 2")
4. Change another setting
5. Click "Save All Settings" again

#### Expected Results:
- ✅ Version number increments (Version 3)
- ✅ Old settings are deactivated in database
- ✅ New settings are marked as active

### ❌ Before Fix:
- Settings would reset on page refresh
- No database persistence
- Only logged to console

---

## 🔧 TEST 4: Issue #4 Fix - Empty State for Plans

**What was broken:** No message when subscription plans table is empty
**What was fixed:** Added friendly empty state message

### Steps:
1. Scroll to "Plan-Specific Commission" card

### Expected Results (if plans exist):
- ✅ See accordion with subscription plans

### Expected Results (if NO plans exist):
- ✅ See empty state with icon
- ✅ Message: "No subscription plans found"
- ✅ Helpful text: "Please create subscription plans first..."

### ❌ Before Fix:
- Just showed empty accordion (confusing)

---

## 🧪 TEST 5: Full Feature Testing

### Test 5A: Network Commission - All Models

#### Model 1: One-time Only
1. Select "Model 1: One-time Commission Only"
2. Change type to "Percentage (%)"
3. Set value to `25%`
4. Check earnings preview updates

#### Model 2: Recurring Only
1. Select "Model 2: Recurring Commission Only"
2. Change type to "Fixed Amount (₹)"
3. Set value to `100`
4. Set duration to `6 months`
5. Check earnings preview shows correct amounts

#### Model 3: Hybrid
1. Select "Model 3: Onboarding + Recurring (Hybrid)"
2. Configure one-time: `15%`
3. Configure recurring: `5%` for `12 months`
4. Check earnings preview shows both commissions

### Test 5B: Validation Testing

Try to save with INVALID values:

1. Set Network Monthly one-time to `150%` (> 100%)
2. Click "Save All Settings"

**Expected:** ❌ Error toast: "percentage must be between 0-100%"

3. Fix percentage, set duration to `30 months` (> 24)
4. Click "Save All Settings"

**Expected:** ❌ Error toast: "Duration must be between 1-24 months"

5. Fix duration, set min payout to `-500` (negative)
6. Click "Save All Settings"

**Expected:** ❌ Error toast: "cannot be negative"

7. Set referral code prefix to empty string `""`
8. Click "Save All Settings"

**Expected:** ❌ Error toast: "cannot be empty"

9. Set referral code to `TOOLONGCODE` (> 6 chars)
10. Click "Save All Settings"

**Expected:** ❌ Error toast: "must be 6 characters or less"

### Test 5C: Feature Toggles

1. Toggle all 4 feature switches:
   - Enable Multi-Tier Helper Program
   - Auto-approve Helper Applications
   - Send Helper Welcome Email
   - Send Commission Earned Notifications

**Expected:** ✅ All toggle smoothly without errors

2. Click "Save All Settings"
3. Refresh page
4. Check toggles retained their state

**Expected:** ✅ Toggle states persist

### Test 5D: Payment Settings

1. Change payment schedule to "Weekly"
2. Check payment day options change to weekdays

**Expected:** ✅ Options update dynamically

3. Change to "Monthly"
4. Check options show "1st", "15th", "Last"

**Expected:** ✅ Options update correctly

### Test 5E: Plan-Specific Commission

1. Expand a subscription plan from accordion
2. Toggle the Enable/Disable switch

**Expected when DISABLED:**
- ✅ Shows red warning: "⚠️ Commission Disabled"
- ✅ Warning text appears

**Expected when ENABLED:**
- ✅ Shows Monthly/Yearly tabs
- ✅ Can configure commission models

3. Configure different models for monthly vs yearly
4. Save settings
5. Refresh page

**Expected:** ✅ Plan-specific settings persist

---

## 📊 EXPECTED CONSOLE OUTPUT

When page loads, you should see:
```
✅ [Supabase] SELECT from commission_settings
✅ [Supabase] SELECT from network_commission
✅ [Supabase] SELECT from subscription_plans
✅ [Supabase] SELECT from plan_commission
```

When you save, you should see:
```
✅ [Supabase] UPDATE commission_settings (deactivate old)
✅ [Supabase] INSERT commission_settings (new version)
✅ [Supabase] INSERT network_commission (monthly)
✅ [Supabase] INSERT network_commission (yearly)
✅ [Supabase] INSERT plan_commission (for each plan)
```

---

## ❌ ERRORS YOU SHOULD NOT SEE

- ❌ "setStoreYearlyOnetimeValue is not defined"
- ❌ "setStoreYearlyRecurringValue is not defined"
- ❌ "commission_settings_audit does not exist"
- ❌ Any uncaught exceptions
- ❌ Failed Supabase queries (except for expected validation errors)

---

## ✅ SUCCESS CRITERIA

All tests pass if:
1. ✅ Yearly commission inputs work without errors
2. ✅ Audit trail loads without table name errors
3. ✅ Settings save to database and persist on refresh
4. ✅ Empty state shows when no subscription plans
5. ✅ All validation catches invalid inputs
6. ✅ All feature toggles work
7. ✅ Commission calculations are correct
8. ✅ No console errors during normal operation

---

## 🐛 FOUND AN ISSUE?

If you find any bugs:
1. Note the exact steps to reproduce
2. Copy the console error message
3. Screenshot the issue
4. Let me know and I'll fix it immediately!

---

## 📝 TEST RESULTS LOG

Fill this out as you test:

- [ ] TEST 1: Yearly Commission Inputs - PASS / FAIL
- [ ] TEST 2: Audit Trail Loading - PASS / FAIL
- [ ] TEST 3A: Load from Database - PASS / FAIL
- [ ] TEST 3B: Save to Database - PASS / FAIL
- [ ] TEST 3C: Settings Versioning - PASS / FAIL
- [ ] TEST 4: Empty State - PASS / FAIL
- [ ] TEST 5A: Network Commission Models - PASS / FAIL
- [ ] TEST 5B: Validation - PASS / FAIL
- [ ] TEST 5C: Feature Toggles - PASS / FAIL
- [ ] TEST 5D: Payment Settings - PASS / FAIL
- [ ] TEST 5E: Plan-Specific Commission - PASS / FAIL

---

**Happy Testing! 🎉**
