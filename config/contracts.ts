/**
 * KUSD System Contract Addresses
 * 
 * This file contains all deployed contract addresses for the KUSD stablecoin system.
 * Addresses are organized by network (testnet/mainnet) and category.
 * 
 * Last Updated: 2025-11-10
 * Deployment: Latest (with sKLC)
 */

export type CollateralType = 'WBTC-A' | 'WETH-A' | 'USDT-A' | 'USDC-A' | 'DAI-A';

export interface CollateralConfig {
  name: string;
  symbol: string;
  decimals: number;
  token: `0x${string}`;
  join: `0x${string}`;
  clipper: `0x${string}`;
  oracle: `0x${string}`;
  ilk: string; // bytes32 representation
}

export interface CoreContracts {
  vat: `0x${string}`;
  kusd: `0x${string}`;
  sklc: `0x${string}`;
  spotter: `0x${string}`;
  jug: `0x${string}`;
  pot: `0x${string}`;
  dog: `0x${string}`;
  vow: `0x${string}`;
  flapper: `0x${string}`;
  flopper: `0x${string}`;
  end: `0x${string}`;
  cure: `0x${string}`;
  kusdJoin: `0x${string}`;
  // DSProxy infrastructure
  proxyRegistry: `0x${string}`;
  proxyFactory: `0x${string}`;
  proxyActions: `0x${string}`;
}

export interface NetworkContracts {
  core: CoreContracts;
  collateral: Record<CollateralType, CollateralConfig>;
}

/**
 * KalyChain Testnet (Chain ID: 3889)
 * Latest deployment with sKLC token
 */
export const TESTNET_CONTRACTS: NetworkContracts = {
  core: {
    vat: '0x0f41476b9fe5280e0f743474d93e01b1d0d7c0fa',
    kusd: '0x6c52f4afb0f23296d8d1c32485207a1e7c9aa3c3',
    sklc: '0x618e9fa8bb2efea686e685dee8bf931cd1a0e5bf',
    spotter: '0x706e2f83ecc695e7d00f0356dd58a6da01b6948a',
    jug: '0x680cdebf55d3a57944e014d16f7c28915655f276',
    pot: '0xf27421765637f916dbe67f015f5ecacbac097ec6',
    dog: '0x186e740d2aabf58124c17ded3cbea92c0e38c9a1',
    vow: '0x0b24d04ddb8c897ca49c5109b23ae1127d7ac578',
    flapper: '0x2c8e1dcc5bcf756c42c67b2c5b775ca1ba6ac278',
    flopper: '0x332c73dd2a6bfda26b5079d9639d7ef0d3377f5c',
    end: '0x8dcd7458caaa6338eb9f21539ecb928a601f86d9',
    cure: '0x227cc898c332711fe277ded32f14693089a9ea07',
    kusdJoin: '0xd8a82798c75031a55366b32c4d9616379cb4a28f',
    // DSProxy infrastructure (deployed 2025-11-11)
    proxyRegistry: '0x1D6CAb472E5488a62925f72ff64604E40EaB6C61',
    proxyFactory: '0x354e8823485b4B5E6eC56F39013a43301450E8AD',
    proxyActions: '0x3A6FA106E2224fc4AC1013BeC8D3f29A920B9B6F', // KssProxyActionsDsr
  },
  collateral: {
    'WBTC-A': {
      name: 'Wrapped Bitcoin',
      symbol: 'WBTC',
      decimals: 8,
      token: '0xd078870166457a5b1c41635aecc920d2fd6288d9',
      join: '0xd34aa348a8edfbe66d3131c1124d165db4f0f035',
      clipper: '0xdd4b5b419945b783aa2b21e014a976bd2445d198',
      oracle: '0x85a8386367755965C95E31B06778B2c89082E316',
      ilk: '0x574254432d410000000000000000000000000000000000000000000000000000', // "WBTC-A"
    },
    'WETH-A': {
      name: 'Wrapped Ether',
      symbol: 'WETH',
      decimals: 18,
      token: '0x29b63072f0478db6063dcb93420bed05bdb0cbe7',
      join: '0xb70f91fed689d0ba5145431a6f7590360ba6102a',
      clipper: '0x84ecaaf53c1b49f482147f7512b833c75ccbc022',
      oracle: '0x935216C74e1838E7090f31756ce0f64a34A5aAce',
      ilk: '0x574554482d410000000000000000000000000000000000000000000000000000', // "WETH-A"
    },
    'USDT-A': {
      name: 'Tether USD',
      symbol: 'USDT',
      decimals: 6,
      token: '0x6fdb0fed277b878a0d80494b06ea054c99d2fdd2',
      join: '0xc18aaf247ea2650fd3bce61f86b0d75099c29434',
      clipper: '0x6712ca4ac3aee8190dc673269fbd5bd9b279d570',
      oracle: '0xf8Be6Ed01e7AE968118cf3db72E7641C59A9Dc4f',
      ilk: '0x555344542d410000000000000000000000000000000000000000000000000000', // "USDT-A"
    },
    'USDC-A': {
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: 6,
      token: '0x71a814325f34208292610c47c79ceb6446c5fae9',
      join: '0x2bd36789e17a06625cedf832c74706e9bdc7f89b',
      clipper: '0xdaf926303b5b9b045d4cc4a677d7a176a4b85b4a',
      oracle: '0x930e5F6D686A19794bc7a1615a40032182D359D7',
      ilk: '0x555344432d410000000000000000000000000000000000000000000000000000', // "USDC-A"
    },
    'DAI-A': {
      name: 'Dai Stablecoin',
      symbol: 'DAI',
      decimals: 18,
      token: '0x0489f68c06f3131965f394470d082a38d35a4898',
      join: '0x0aed0b81f943366d975cf2003b69c478c0c86e3f',
      clipper: '0xfe96928f21dc00ee7d2861e15e424f85e93dc69a',
      oracle: '0x301F4fbd60156568d87932c42b3C17Bd5F0f33BD',
      ilk: '0x4441492d41000000000000000000000000000000000000000000000000000000', // "DAI-A"
    },
  },
};

/**
 * KalyChain Mainnet (Chain ID: 3888)
 * TODO: Update with mainnet addresses when deployed
 */
export const MAINNET_CONTRACTS: NetworkContracts = {
  core: {
    vat: '0x0000000000000000000000000000000000000000',
    kusd: '0x0000000000000000000000000000000000000000',
    sklc: '0x0000000000000000000000000000000000000000',
    spotter: '0x0000000000000000000000000000000000000000',
    jug: '0x0000000000000000000000000000000000000000',
    pot: '0x0000000000000000000000000000000000000000',
    dog: '0x0000000000000000000000000000000000000000',
    vow: '0x0000000000000000000000000000000000000000',
    flapper: '0x0000000000000000000000000000000000000000',
    flopper: '0x0000000000000000000000000000000000000000',
    end: '0x0000000000000000000000000000000000000000',
    cure: '0x0000000000000000000000000000000000000000',
    kusdJoin: '0x0000000000000000000000000000000000000000',
    proxyRegistry: '0x0000000000000000000000000000000000000000',
    proxyFactory: '0x0000000000000000000000000000000000000000',
    proxyActions: '0x0000000000000000000000000000000000000000',
  },
  collateral: {
    'WBTC-A': {
      name: 'Wrapped Bitcoin',
      symbol: 'WBTC',
      decimals: 8,
      token: '0x0000000000000000000000000000000000000000',
      join: '0x0000000000000000000000000000000000000000',
      clipper: '0x0000000000000000000000000000000000000000',
      oracle: '0x0000000000000000000000000000000000000000',
      ilk: '0x574254432d410000000000000000000000000000000000000000000000000000',
    },
    'WETH-A': {
      name: 'Wrapped Ether',
      symbol: 'WETH',
      decimals: 18,
      token: '0x0000000000000000000000000000000000000000',
      join: '0x0000000000000000000000000000000000000000',
      clipper: '0x0000000000000000000000000000000000000000',
      oracle: '0x0000000000000000000000000000000000000000',
      ilk: '0x574554482d410000000000000000000000000000000000000000000000000000',
    },
    'USDT-A': {
      name: 'Tether USD',
      symbol: 'USDT',
      decimals: 6,
      token: '0x0000000000000000000000000000000000000000',
      join: '0x0000000000000000000000000000000000000000',
      clipper: '0x0000000000000000000000000000000000000000',
      oracle: '0x0000000000000000000000000000000000000000',
      ilk: '0x555344542d410000000000000000000000000000000000000000000000000000',
    },
    'USDC-A': {
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: 6,
      token: '0x0000000000000000000000000000000000000000',
      join: '0x0000000000000000000000000000000000000000',
      clipper: '0x0000000000000000000000000000000000000000',
      oracle: '0x0000000000000000000000000000000000000000',
      ilk: '0x555344432d410000000000000000000000000000000000000000000000000000',
    },
    'DAI-A': {
      name: 'Dai Stablecoin',
      symbol: 'DAI',
      decimals: 18,
      token: '0x0000000000000000000000000000000000000000',
      join: '0x0000000000000000000000000000000000000000',
      clipper: '0x0000000000000000000000000000000000000000',
      oracle: '0x0000000000000000000000000000000000000000',
      ilk: '0x4441492d41000000000000000000000000000000000000000000000000000000',
    },
  },
};

/**
 * Get contracts for a specific chain ID
 */
export function getContracts(chainId: number): NetworkContracts {
  switch (chainId) {
    case 3889: // KalyChain Testnet
      return TESTNET_CONTRACTS;
    case 3888: // KalyChain Mainnet
      return MAINNET_CONTRACTS;
    default:
      throw new Error(`Unsupported chain ID: ${chainId}`);
  }
}

/**
 * Get collateral config by type
 */
export function getCollateral(chainId: number, type: CollateralType): CollateralConfig {
  const contracts = getContracts(chainId);
  return contracts.collateral[type];
}

/**
 * Get all collateral types
 */
export function getAllCollateralTypes(): CollateralType[] {
  return ['WBTC-A', 'WETH-A', 'USDT-A', 'USDC-A', 'DAI-A'];
}

/**
 * Get collateral display name
 */
export function getCollateralDisplayName(type: CollateralType): string {
  const [symbol] = type.split('-');
  return symbol;
}

/**
 * Check if contracts are deployed (not zero addresses)
 */
export function areContractsDeployed(chainId: number): boolean {
  const contracts = getContracts(chainId);
  return contracts.core.vat !== '0x0000000000000000000000000000000000000000';
}

