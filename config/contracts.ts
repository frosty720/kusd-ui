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
 * KMT relaunch chain (Chain ID: 3890)
 * KUSD core deployed 2026-08-21, PSM + proxy stack 2026-08-24.
 * PSM-ONLY LAUNCH: all CDP ilk debt ceilings are 0 and no oracles are set (oracle: zero address).
 * CDP/vault pages cannot mint on this chain until ceilings reopen; PSM swap + DSR work.
 */
export const KMT_CONTRACTS: NetworkContracts = {
  core: {
    vat: '0x27f56ab259cba4a69e779d712f6dd27b6a6aecc6',
    kusd: '0xfdb3307a16442ed5a7c040ae1600a3b3d3c8e7d9',
    sklc: '0x80f6040833fefbf961ca4a20ad704aadd3a43716',
    spotter: '0xd1b01ab0bcb76b9bf88a41fd1c87fb7c89c9da60',
    jug: '0x2da3076fc64f455ed50531e91a7c81031d06719b',
    pot: '0x14d856578d6b86aebe8c2abba4f4983c6a943efa',
    dog: '0x4f4447477146f997f3d44d227b633ced20506bc3',
    vow: '0x0e529be03ee0090a82d9d669edb9f897e54503ec',
    flapper: '0x505baae056396f28c8e757803a7f924b1a04eb70',
    flopper: '0x57a8e257ac667a02f1959bdff111e29a667ef74a',
    end: '0x33e87abbb7fe9f9eac6ed1274238bbd9d7e4c753',
    cure: '0x103257d5dfa7cf89813e62b07610b782f85ced0e',
    kusdJoin: '0xcabc917c1a2da2973ac455491adab2acb554fd9b',
    // DSProxy infrastructure (deployed 2026-08-24)
    proxyRegistry: '0x3ab9f329dd96ecdbe21be3cf45786beb4216e66c',
    proxyFactory: '0xc9820bcb8d9ffe79157e6dc4b278a0bebd826808',
    proxyActions: '0xd074f8611aa4f6daeeaae17421a395cbe8fa0637', // KssProxyActionsDsr (matches mainnet convention)
  },
  collateral: {
    'WBTC-A': {
      name: 'Wrapped Bitcoin',
      symbol: 'WBTC',
      decimals: 8,
      token: '0xE3f1A8Af16d2Dcd0B6F1F813C449375f85C9d97F',
      join: '0x6badb4a1cb00de3069555191f1e3391b2c58d459',
      clipper: '0x680ab6654a76e0f2db3eeeca42b42516e5a1945f',
      oracle: '0x0000000000000000000000000000000000000000', // no oracles on 3890 (PSM-only launch)
      ilk: '0x574254432d410000000000000000000000000000000000000000000000000000',
    },
    'WETH-A': {
      name: 'Wrapped Ether',
      symbol: 'WETH',
      decimals: 18,
      token: '0x73b8fBACFF08DafD9a0a6cB8699C64a488d9EA2a',
      join: '0x3ea23f0bb9479d723eb7370befe5368df6ee826c',
      clipper: '0x686911f278e64c31e476169d1ac06e877b211323',
      oracle: '0x0000000000000000000000000000000000000000',
      ilk: '0x574554482d410000000000000000000000000000000000000000000000000000',
    },
    'USDT-A': {
      name: 'Tether USD',
      symbol: 'USDT',
      decimals: 6,
      token: '0x6318EcDbae6B469D39C38949eDC671f4bA8A6172',
      join: '0xcaaac89835a5d7493eda7470b57e4c1517c1921f',
      clipper: '0xd0a1d1b8e10625ee7ed4be4aa7afa7f169411fbd',
      oracle: '0x0000000000000000000000000000000000000000',
      ilk: '0x555344542d410000000000000000000000000000000000000000000000000000',
    },
    'USDC-A': {
      name: 'USD Coin',
      symbol: 'USDC',
      decimals: 6,
      token: '0xf00A4b733093C21b0892eae0578F0a926f9370b3',
      join: '0xf0bbd784d49f3dbe742a39f6d2367fe923ce11cd',
      clipper: '0xfe4a1f892096ef6de5af352cd8f25f7461e9dece',
      oracle: '0x0000000000000000000000000000000000000000',
      ilk: '0x555344432d410000000000000000000000000000000000000000000000000000',
    },
    'DAI-A': {
      name: 'Dai Stablecoin',
      symbol: 'DAI',
      decimals: 18,
      token: '0x8fbff791fCcF596DEf2e788549d0275557F95A21',
      join: '0x421fb81abcd1f9304020e2ede4566584a15f841e',
      clipper: '0x4e7001fa7fecb09407e5570d72b6703a44ea7d48',
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
    case 3890: // KMT relaunch chain
      return KMT_CONTRACTS;
    default:
      throw new Error(`Unsupported chain ID: ${chainId}`);
  }
}

/**
 * Per-network app settings that are not contract addresses of the KUSD core.
 */
export interface NetworkSettings {
  /** The collateral whose token the PSM swaps against KUSD — the peg's quote stable. */
  pegStable: CollateralType;
  /** Where the KUSD market price is read: a V2 pair (NEXT_PUBLIC_DEX_PAIR_ADDRESS) or V3 pools. */
  peg:
    | { kind: 'v2' }
    | { kind: 'v3'; factory: `0x${string}`; feeTiers: readonly number[] };
  /** KeyPass NFT whose holders may open /admin. */
  adminNft: `0x${string}`;
}

const LEGACY_SETTINGS: NetworkSettings = {
  pegStable: 'USDC-A',
  peg: { kind: 'v2' },
  adminNft: '0x6B9557d1A52B9813288f45518D880C891b49491a',
};

/** 3890 has no V2 DEX: KUSD trades on KalySwap V3, against USDT (the USDT PSM's gem). */
const KMT_SETTINGS: NetworkSettings = {
  pegStable: 'USDT-A',
  peg: { kind: 'v3', factory: '0x79e8391b5cD2a3Cfd43F1A4Eb1a55796331e07F5', feeTiers: [100, 500, 3000, 10000] },
  adminNft: '0x75A00d81c37c27f60F1C855cF200592B43B35a34',
};

export function getNetworkSettings(chainId: number): NetworkSettings {
  switch (chainId) {
    case 3889:
    case 3888:
      return LEGACY_SETTINGS;
    case 3890:
      return KMT_SETTINGS;
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

