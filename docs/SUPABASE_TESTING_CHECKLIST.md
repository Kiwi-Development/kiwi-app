# Supabase Integration Testing Checklist

## ✅ Authentication

- [x] User can log in
- [x] User session is properly detected in stores
- [ ] User can log out (if logout functionality exists)

## Personas (`persona-store.ts`)

### Create

- [x] Create a new persona with all fields
- [ ] Verify persona appears in the list immediately
- [ ] Verify persona is saved to database (check Supabase dashboard)
- [ ] Verify initial persona version is created automatically (check `persona_versions` table)

### Read

- [x] List all personas
- [ ] Filter personas (if filtering exists)
- [ ] Verify personas are sorted correctly (by last_used_at)
- [ ] Verify only user's own personas are shown (RLS test)

### Update

- [ ] Edit an existing persona
- [ ] Verify changes are saved
- [ ] Verify new persona version is created on update (check `persona_versions` table)
- [ ] Verify `current_version_id` is updated

### Delete

- [ ] Delete a persona
- [ ] Verify persona is soft-deleted (check `deleted_at` is set)
- [ ] Verify persona no longer appears in list
- [ ] Verify persona still exists in database (soft delete)

## Tests (`test-store.ts`)

### Create

- [ ] Create a new test
- [ ] Verify test appears in the list
- [ ] Verify test is saved to database
- [ ] Verify test has correct user_id

### Read

- [ ] List all tests
- [ ] Get test by ID
- [ ] Verify test data includes latest test run info
- [ ] Verify test data includes feedback entries
- [ ] Verify only user's own tests are shown (RLS test)

### Update

- [ ] Update test progress
- [ ] Verify success_rate is calculated correctly
- [ ] Verify status updates correctly (running → completed)
- [ ] Update test details

### Delete

- [ ] Delete a test
- [ ] Verify test is soft-deleted
- [ ] Verify test no longer appears in list

## Test Runs (`run-store.ts`)

### Active Runs (localStorage)

- [ ] Save active run to localStorage
- [ ] Retrieve active run
- [ ] Clear active run

### Completed Runs (Database)

- [ ] Complete a test run
- [ ] Verify `saveCompletedRun()` saves to `test_runs` table
- [ ] Verify test run has correct test_id
- [ ] Verify test run has correct persona_version_id
- [ ] Verify metrics are saved (duration, action_count, etc.)

## Database Triggers & Functions

### Profile Auto-Creation

- [ ] Create a new user account
- [ ] Verify profile is automatically created in `profiles` table
- [ ] Verify profile has correct user_id

### Persona Versioning

- [ ] Create persona → verify initial version (version_number = 1)
- [ ] Update persona → verify new version (version_number = 2)
- [ ] Verify `current_version_id` is updated

### Activity Logging

- [ ] Create persona → check `activity_log` table
- [ ] Update persona → check `activity_log` table
- [ ] Create test → check `activity_log` table
- [ ] Complete test run → check `activity_log` table

### Updated At Timestamps

- [ ] Update persona → verify `updated_at` is updated
- [ ] Update test → verify `updated_at` is updated

### Last Used Tracking

- [ ] Run a test with a persona
- [ ] Verify persona's `last_used_at` is updated

## Row Level Security (RLS)

### Personas

- [ ] User A can only see their own personas
- [ ] User A cannot see User B's personas
- [ ] User A cannot update User B's personas
- [ ] User A cannot delete User B's personas

### Tests

- [ ] User A can only see their own tests
- [ ] User A cannot see User B's tests
- [ ] User A cannot update User B's tests
- [ ] User A cannot delete User B's tests

### Test Runs

- [ ] User A can only see their own test runs
- [ ] User A cannot see User B's test runs

## Error Handling

### Network Errors

- [ ] Test with network disconnected
- [ ] Verify graceful error handling
- [ ] Verify user-friendly error messages

### Authentication Errors

- [ ] Test with expired session
- [ ] Test with invalid session
- [ ] Verify proper error messages

### Database Errors

- [ ] Test with invalid data (e.g., missing required fields)
- [ ] Test with duplicate data (if applicable)
- [ ] Verify error messages are clear

## Performance

### Large Datasets

- [ ] Test with 50+ personas
- [ ] Test with 50+ tests
- [ ] Verify queries are performant
- [ ] Check for N+1 query issues

### Real-time Updates

- [ ] Test if real-time subscriptions are used (if applicable)
- [ ] Verify updates appear without refresh

## Data Integrity

### Foreign Keys

- [ ] Delete a persona used in a test → verify behavior
- [ ] Delete a test with test runs → verify behavior
- [ ] Verify cascade deletes work correctly

### Constraints

- [ ] Test required fields
- [ ] Test unique constraints (if any)
- [ ] Test enum values

## Integration Points

### Test Creation Flow

1. [ ] Create a test
2. [ ] Select a persona
3. [ ] Run the test
4. [ ] Verify test run is created
5. [ ] Verify feedback entries are created
6. [ ] Verify test metrics are updated

### Persona Usage Flow

1. [ ] Create a persona
2. [ ] Use persona in a test
3. [ ] Verify `last_used_at` is updated
4. [ ] Verify persona version is used correctly

## Edge Cases

### Empty States

- [ ] Test with no personas
- [ ] Test with no tests
- [ ] Verify UI handles empty states gracefully

### Concurrent Updates

- [ ] Update same persona from two tabs
- [ ] Verify last write wins or proper conflict handling

### Special Characters

- [ ] Test persona names with special characters
- [ ] Test test titles with special characters
- [ ] Verify data is stored and retrieved correctly

## Browser Compatibility

- [ ] Test in Chrome
- [ ] Test in Firefox
- [ ] Test in Safari
- [ ] Test in mobile browsers (if applicable)

## Notes

- All tests should be done while authenticated
- Check Supabase dashboard to verify data is actually saved
- Check browser console for any errors
- Monitor network tab for API calls
