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
 * Deployed: December 2025
 */
export const MAINNET_CONTRACTS: NetworkContracts = {
  core: {
    vat: '0xd3f7d3fdb52bc3ae7c69e12c2a87af49b632505c',
    kusd: '0xcd02480926317748e95c5bbbbb7d1070b2327f1a',
    sklc: '0x86c0ea2bf60f86c88a227b00308cac07b38deb2c',
    spotter: '0xf76f2447fbe15582e47218d0510216f835a80db7',
    jug: '0x70806c83da93635a452e3c395cfde55e283ed1a4',
    pot: '0x2268c2da9f04230d6ba451afece52c244f235c44',
    dog: '0xae50bf432f64a77f0bea6961458da4e486e997b9',
    vow: '0x334f479678cc6c8017743effef22818aca9ff7ef',
    flapper: '0x40475623957bccf0ac55b9ac7f6ebe472852aa0c',
    flopper: '0x4d611877b59543caa972359bc4def7775b22ec58',
    end: '0x71b342a953fbd6483f8d520d841665f8d7b2a619',
    cure: '0x609317bfa3007e0c57a4a750d82f8733f890c9ac',
    kusdJoin: '0x90fdfd47dfaf84ccd568a596dc70ec2c0d80c571',
    proxyRegistry: '0x5649cfb8fca0657b6b33461a2d2ac26e62713c49',
    proxyFactory: '0x7dBd86439CcFfA5b0883667631FdE919f0184B27',
    proxyActions: '0xe5803927A79BfEf86Ef8055bed4be1a9454414EB', // KssProxyActionsDsr (deployed 2026-01-12)
  },
  collateral: {
    'WBTC-A': {
      name: 'Wrapped Bitcoin',
      symbol: 'WBTC',
      decimals: 8,
      token: '0xaA77D4a26d432B82DB07F8a47B7f7F623fd92455',
      join: '0xb1c48ad6d623a72c07e7ece7b141f548c35ae6fb',
      clipper: '0x13e96f537709f7a79d4fc9be0e3e4d863232f63e',
      oracle: '0x28f51A114Ffcf36FB77D6ded40807a6415782f5d',
      ilk: '0x574254432d410000000000000000000000000000000000000000000000000000',
    },
    'WETH-A': {
      name: 'Wrapped Ether',
      symbol: 'WETH',
      decimals: 18,
      token: '0xfdbB253753dDE60b11211B169dC872AaE672879b',
      join: '0x632e9740d63b7c88a2cb42105ccc264b1038cf6c',
      clipper: '0xa6bb3dc8bd773080f23afe4248e8d47f85f359a6',
      oracle: '0x80E64f28656e1C95F4dF231536D8dC411822053c',
      ilk: '0x574554482d410000000000000000000000000000000000000000000000000000',
    },
    'USDT-A': {
      name: 'Tether USD',
      symbol: 'USDT',
      decimals: 6,
      token: '0x2CA775C77B922A51FcF3097F52bFFdbc0250D99A',
      join: '0xade482e0abf693d4a4f02ffe90756288cfd5e720',
      clipper: '0x3b0eedaa0a6cb7d3a5b3e59b76c261fb5d738eaa',
      oracle: '0xC5342aDDbecabF78d92Ca3c218879d4F767a0D30',
      ilk: '0x555344542d410000000000000000000000000000000000000000000000000000',
    },
    'USDC-A': {
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: 6,
      token: '0x9cAb0c396cF0F4325913f2269a0b72BD4d46E3A9',
      join: '0x0eb899b93f9a97d13878dcb785675222fb8948a5',
      clipper: '0xe658b15137f3081cd62a25873bb7d3d73e9d3233',
      oracle: '0xF89dE104147bb36f5473c30eC1d2C067c81ff04E',
      ilk: '0x555344432d410000000000000000000000000000000000000000000000000000',
    },
    'DAI-A': {
      name: 'Dai Stablecoin',
      symbol: 'DAI',
      decimals: 18,
      token: '0x6E92CAC380F7A7B86f4163fad0df2F277B16Edc6',
      join: '0xcdb96345acc74000211b5235dd1b4da97e130108',
      clipper: '0xfb9fd22a23953a50e0f49d1e4eb64653560118db',
      oracle: '0x7Ef8fe406191CB2a7C2671FF724f2eAbCbbd22cF',
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

