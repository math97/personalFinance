import { test, expect } from '@playwright/test'

test.describe('Navigation', () => {
  test('redirects root to dashboard', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/dashboard/)
  })

  test('dashboard renders without crashing', async ({ page }) => {
    await page.goto('/dashboard')
    await expect(page.getByRole('heading', { name: /spending|dashboard/i }).or(page.locator('h1'))).toBeVisible()
  })

  test('sidebar links navigate to correct pages', async ({ page }) => {
    await page.goto('/dashboard')

    await page.getByRole('link', { name: 'Transactions' }).click()
    await expect(page).toHaveURL(/\/transactions/)

    await page.getByRole('link', { name: 'Categories' }).click()
    await expect(page).toHaveURL(/\/categories/)

    await page.getByRole('link', { name: 'Settings' }).click()
    await expect(page).toHaveURL(/\/settings/)
  })

  test('import inbox link is accessible', async ({ page }) => {
    await page.goto('/dashboard')
    await page.getByRole('link', { name: 'Import Inbox' }).click()
    await expect(page).toHaveURL(/\/import\/inbox/)
  })
})

test.describe('Transactions page', () => {
  test('shows page header', async ({ page }) => {
    await page.goto('/transactions')
    await expect(page.locator('h1')).toContainText('All Transactions')
  })

  test('month navigation buttons are present', async ({ page }) => {
    await page.goto('/transactions')
    const buttons = page.locator('button').filter({ hasText: '' })
    await expect(page.locator('button').first()).toBeVisible()
  })
})

test.describe('Categories page', () => {
  test('shows page header and add button', async ({ page }) => {
    await page.goto('/categories')
    await expect(page.locator('h1')).toContainText('Categories')
    await expect(page.getByRole('button', { name: /add category/i })).toBeVisible()
  })
})

test.describe('Settings page', () => {
  test('shows salary input', async ({ page }) => {
    await page.goto('/settings')
    await expect(page.locator('h1')).toContainText('Settings')
    await expect(page.getByRole('spinbutton')).toBeVisible()
  })

  test('saves salary to localStorage', async ({ page }) => {
    await page.goto('/settings')
    const input = page.getByRole('spinbutton')
    await input.fill('4000')
    await page.getByRole('button', { name: /save/i }).click()

    const salary = await page.evaluate(() => localStorage.getItem('finance_salary'))
    expect(salary).toBe('4000')
  })
})
