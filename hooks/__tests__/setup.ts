/**
 * Test setup for hooks
 * 
 * Mocks wagmi hooks for testing without actual blockchain connection.
 */

import { vi } from 'vitest'

// Mock wagmi hooks
export const mockUseReadContract = vi.fn()
export const mockUseWriteContract = vi.fn()
export const mockUseWaitForTransactionReceipt = vi.fn()

vi.mock('wagmi', () => ({
  useReadContract: () => mockUseReadContract(),
  useWriteContract: () => mockUseWriteContract(),
  useWaitForTransactionReceipt: () => mockUseWaitForTransactionReceipt(),
}))

// Default mock implementations
export function setupDefaultMocks() {
  mockUseReadContract.mockReturnValue({
    data: undefined,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  })

  mockUseWriteContract.mockReturnValue({
    data: undefined,
    writeContract: vi.fn(),
    isPending: false,
    error: null,
  })

  mockUseWaitForTransactionReceipt.mockReturnValue({
    isLoading: false,
    isSuccess: false,
  })
}

// Reset all mocks
export function resetMocks() {
  mockUseReadContract.mockReset()
  mockUseWriteContract.mockReset()
  mockUseWaitForTransactionReceipt.mockReset()
}

