/** Dev menu tail UI for Bitburner.
 *  Drop this on home and run it as a JSX script. It uses webpack discovery to
 *  reach the same internal game objects used by the native development menu.
 */

const BIG = 1e27;
const MAX_FAVOR = 35331;
const VALID_BITNODES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];
const DEFAULT_PROGRAMS = [
  "NUKE.exe",
  "BruteSSH.exe",
  "FTPCrack.exe",
  "relaySMTP.exe",
  "HTTPWorm.exe",
  "SQLInject.exe",
  "DeepscanV1.exe",
  "DeepscanV2.exe",
  "ServerProfiler.exe",
  "AutoLink.exe",
  "Formulas.exe",
  "b1t_flum3.exe",
  "fl1ght.exe",
  "DarkscapeNavigator.exe",
  "STORM_SEED.exe",
];
const DEFAULT_CONTRACT_TYPES = [
  "Find Largest Prime Factor",
  "Subarray with Maximum Sum",
  "Total Ways to Sum",
  "Total Ways to Sum II",
  "Spiralize Matrix",
  "Array Jumping Game",
  "Array Jumping Game II",
  "Merge Overlapping Intervals",
  "Generate IP Addresses",
  "Algorithmic Stock Trader I",
  "Algorithmic Stock Trader II",
  "Algorithmic Stock Trader III",
  "Algorithmic Stock Trader IV",
  "Minimum Path Sum in a Triangle",
  "Unique Paths in a Grid I",
  "Unique Paths in a Grid II",
  "Shortest Path in a Grid",
  "Sanitize Parentheses in Expression",
  "Find All Valid Math Expressions",
  "HammingCodes: Integer to Encoded Binary",
  "HammingCodes: Encoded Binary to Integer",
  "Proper 2-Coloring of a Graph",
  "Compression I: RLE Compression",
  "Compression II: LZ Decompression",
  "Compression III: LZ Compression",
  "Encryption I: Caesar Cipher",
  "Encryption II: Vigenère Cipher",
  "Square Root",
  "Total Number of Primes",
  "Largest Rectangle in a Matrix",
];
const DEFAULT_BLADE_SKILLS = [
  "Blade's Intuition",
  "Cloak",
  "Short-Circuit",
  "Digital Observer",
  "Tracer",
  "Overclock",
  "Reaper",
  "Evasive System",
  "Datamancer",
  "Cyber's Edge",
  "Hands of Midas",
  "Hyperdrive",
];
const DEFAULT_GANG_FACTIONS = [
  "Slum Snakes",
  "Tetrads",
  "The Syndicate",
  "The Dark Army",
  "Speakers for the Dead",
  "NiteSec",
  "The Black Hand",
];
const DARKNET_SERVER_TYPES = [
  "RANDOM",
  "110100100",
  "2G_cellular",
  "AccountsManager_4.2",
  "BellaCuore",
  "BigMo%od",
  "CloudBlare(tm)",
  "DeepGreen",
  "DeskMemo_3.1",
  "EuroZone Free",
  "Factori-Os",
  "FreshInstall_1.0",
  "KingOfTheHill",
  "Laika4",
  "MathML",
  "NIL",
  "OctantVoxel",
  "OpenWebAccessPoint",
  "OrdoXenos",
  "PHP 5.4",
  "Pr0verFl0",
  "PrimeTime 2",
  "RateMyPix.Auth",
  "TopPass",
  "ZeroLogon",
];
const DARKNET_CONFIG_BY_EXPORT = {
  getNoPasswordConfig: "ZeroLogon",
  getDefaultPasswordConfig: "FreshInstall_1.0",
  getEchoVulnConfig: "DeskMemo_3.1",
  getSortedEchoVulnConfig: "PHP 5.4",
  getCaptchaConfig: "CloudBlare(tm)",
  getDogNameConfig: "Laika4",
  getGuessNumberConfig: "AccountsManager_4.2",
  getLargeDictionaryConfig: "TopPass",
  getEuCountryDictionaryConfig: "EuroZone Free",
  getYesn_tConfig: "NIL",
  getRomanNumeralConfig: "BellaCuore",
  getBufferOverflowConfig: "Pr0verFl0",
  getMastermindHintConfig: "DeepGreen",
  getTimingAttackConfig: "2G_cellular",
  getLargestPrimeFactorConfig: "PrimeTime 2",
  getBinaryEncodedConfig: "110100100",
  getSpiceLevelConfig: "RateMyPix.Auth",
  getConvertToBase10Config: "OctantVoxel",
  getParseArithmeticExpressionConfig: "MathML",
  getDivisibilityTestConfig: "Factori-Os",
  getTripleModuloConfig: "BigMo%od",
  getKingOfTheHillConfig: "KingOfTheHill",
  getPacketSnifferConfig: "OpenWebAccessPoint",
  getXorMaskEncryptedPasswordConfig: "OrdoXenos",
};
const DARKNET_FUNC_BY_EXPORT = {
  serverFactory: "serverFactory",
  moveDarknetServer: "moveDarknetServer",
  createDarknetServer: "createDarknetServer",
  addRandomDarknetServers: "addRandomDarknetServers",
  moveRandomDarknetServers: "moveRandomDarknetServers",
  deleteRandomDarknetServers: "deleteRandomDarknetServers",
  restartAllDarknetServers: "restartAllDarknetServers",
  balanceDarknetServers: "balanceDarknetServers",
  validateDarknetNetwork: "validateDarknetNetwork",
  clearDarknet: "clearDarknet",
  populateDarknet: "populateDarknet",
  launchWebstorm: "launchWebstorm",
};
const DARKNET_SERVER_GENERATOR_EXPORTS = {
  K0: "serverFactory",
  bW: "createDarknetServer",
};
const DARKNET_MOVEMENT_EXPORTS = {
  Sw: "moveDarknetServer",
  G3: "addRandomDarknetServers",
  oY: "moveRandomDarknetServers",
  AP: "deleteRandomDarknetServers",
  w4: "restartAllDarknetServers",
  _H: "balanceDarknetServers",
  wL: "validateDarknetNetwork",
};
const DARKNET_NETWORK_GENERATOR_EXPORTS = {
  vv: "clearDarknet",
  u9: "populateDarknet",
};
const DARKNET_WEBSTORM_EXPORTS = {
  P: "launchWebstorm",
};
const CODING_CONTRACT_GENERATOR_EXPORTS = {
  generateDummyContract: "generateDummyContract",
  es: "generateDummyContract",
};
const DEFAULT_AUGS = [
  "NeuroFlux Governor",
  "The Red Pill",
  "Stanek's Gift - Genesis",
  "Stanek's Gift - Awakening",
  "Stanek's Gift - Serenity",
  "The Blade's Simulacrum",
  "The Shadow's Simulacrum",
  "CashRoot Starter Kit",
  "SoA - Might of Ares",
  "The B1ade of Solomonoff",
];
const STATS = [
  ["Hacking", "hacking", "gainHackingExp", "HackingLevelMultiplier"],
  ["Strength", "strength", "gainStrengthExp", "StrengthLevelMultiplier"],
  ["Defense", "defense", "gainDefenseExp", "DefenseLevelMultiplier"],
  ["Dexterity", "dexterity", "gainDexterityExp", "DexterityLevelMultiplier"],
  ["Agility", "agility", "gainAgilityExp", "AgilityLevelMultiplier"],
  ["Charisma", "charisma", "gainCharismaExp", "CharismaLevelMultiplier"],
  ["Intelligence", "intelligence", "gainIntelligenceExp", "IntelligenceLevelMultiplier"],
];

const openDB = new Set();
const defaultMenuState = {
  viewMode: "Mini",
  selectedRows: ["General"],
  hiddenRows: [],
};
const menuState = {
  viewMode: defaultMenuState.viewMode,
  selectedRows: [...defaultMenuState.selectedRows],
  hiddenRows: [...defaultMenuState.hiddenRows],
};

/** @param {NS} api */
export async function main(api) {
  let startup = cacheStartupApi(api);
  startup.disableLog("ALL");
  startup.clearLog();
  startup.openTail();
  startup.setTailTitle("SphyxOS Dev Menu");
  startup.resizeTail(860, 720);

  const React = getReactLib();
  if (!React) {
    startup.print("React runtime was not available. Open a tail and run this after the game UI has loaded.");
    startup = null;
    return;
  }
  exposeInternalGameObjects();
  startup.printRaw(<DevMenuApp></DevMenuApp>);
  startup = null;
}

function cacheStartupApi(api) {
  const noop = () => undefined;
  const bind = (target, name) => typeof target?.[name] === "function" ? target[name].bind(target) : noop;
  const ui = api?.ui;
  return {
    disableLog: bind(api, "disableLog"),
    clearLog: bind(api, "clearLog"),
    openTail: bind(ui, "openTail"),
    setTailTitle: bind(ui, "setTailTitle"),
    resizeTail: bind(ui, "resizeTail"),
    print: bind(api, "print"),
    printRaw: bind(api, "printRaw"),
  };
}

function getReactLib() {
  return globalThis.React ?? globalThis["window"]?.React;
}

function safeFunctionSource(value) {
  if (typeof value !== "function") return "";
  try {
    return Function.prototype.toString.call(value);
  } catch { }
  try {
    return String(value);
  } catch {
    return "";
  }
}

function exposeWebpackRequire() {
  if (globalThis.webpackRequire) return;
  if (!globalThis.webpackChunkbitburner?.push) return;
  globalThis.webpackChunkbitburner.push([[-1], {}, (webpackRequire) => (globalThis.webpackRequire = webpackRequire)]);
}

function getSkippedWebpackModuleIds() {
  try {
    return new Set(Object.keys(globalThis.webpackChunkbitburner?.[0]?.[1] ?? {}));
  } catch {
    return new Set();
  }
}

function looksLikeUnmaskedFunction(value, text) {
  return safeFunctionSource(value).includes(text);
}

function exposeInternalGameObjects(force = false) {
  if (!globalThis.webpackChunkbitburner) return;
  exposeWebpackRequire();
  if (!globalThis.webpackRequire?.m) return;
  if (globalThis.__devMenuTestBridge && !force) return;
  globalThis.__devMenuTestBridge = discoverGameObjects(force);
}

function discoverGameObjects(force = false) {
  if (globalThis.__devMenuTestBridge && !force) return globalThis.__devMenuTestBridge;
  exposeWebpackRequire();
  const bridge = {
    modules: [],
    Player: globalThis.Bitburner?.Player,
    Factions: globalThis.Bitburner?.Factions,
    Companies: globalThis.Bitburner?.Companies,
    Router: globalThis.Router,
    GetServer: globalThis.GetServer,
    GetAllServers: globalThis.Bitburner?.GetAllServers,
    Engine: undefined,
    currentNodeMults: undefined,
    achievements: undefined,
    Augmentations: undefined,
    StockMarket: undefined,
    staneksGift: undefined,
    DarknetState: undefined,
    DarknetEvents: undefined,
    SnackbarEvents: undefined,
    funcs: {},
    enums: {},
    darknetConfigBuilders: {},
    errors: [],
  };
  const req = globalThis.webpackRequire;
  if (!req?.m) {
    globalThis.__devMenuTestBridge = bridge;
    return bridge;
  }

  const skippedModuleIds = getSkippedWebpackModuleIds();
  for (const moduleId of Object.keys(req.m).filter((id) => !skippedModuleIds.has(id))) {
    let module;
    try {
      module = req(moduleId);
    } catch (error) {
      bridge.errors.push(String(error?.message ?? error));
      continue;
    }
    if (!module) continue;
    bridge.modules.push(module);
    const exportedEntries = [["__module", module], ...objectEntries(module)];

    for (const [exportName, value] of exportedEntries) {
      try {
        if (!value) continue;
        if (!bridge.Router && value.page && value.toPage) bridge.Router = value;
        if (!bridge.Player && isPlayerObject(value)) bridge.Player = value;
        if (!bridge.Factions && isFactionsObject(value)) bridge.Factions = value;
        if (!bridge.Companies && isCompaniesObject(value)) bridge.Companies = value;
        if (!bridge.Engine && isEngineObject(value)) bridge.Engine = value;
        if (!bridge.currentNodeMults && isNodeMultObject(value)) bridge.currentNodeMults = value;
        if (!bridge.achievements && isAchievementsObject(value)) bridge.achievements = value;
        if (!bridge.Augmentations && (exportName === "Augmentations" || isAugmentationsObject(value))) bridge.Augmentations = value;
        if (!bridge.StockMarket && isStockMarketObject(value)) bridge.StockMarket = value;
        if (!bridge.staneksGift && isStanekObject(value)) bridge.staneksGift = value;
        if (!bridge.DarknetState && isDarknetState(value)) bridge.DarknetState = value;
        if (!bridge.DarknetEvents && value?.emit && value?.subscribe && value?.unsubscribe) bridge.DarknetEvents = value;
        if (!bridge.SnackbarEvents && exportName === "SnackbarEvents" && isEventEmitterObject(value)) bridge.SnackbarEvents = value;

        if (typeof value === "object") {
          if (!bridge.enums.AugmentationName && enumHas(value, ["NeuroFlux Governor", "The Red Pill"])) bridge.enums.AugmentationName = value;
          if (!bridge.enums.CompletedProgramName && enumHas(value, ["NUKE.exe", "BruteSSH.exe", "Formulas.exe"])) bridge.enums.CompletedProgramName = value;
          if (!bridge.enums.CodingContractName && enumHas(value, ["Find Largest Prime Factor", "Total Ways to Sum"])) bridge.enums.CodingContractName = value;
          if (!bridge.enums.BladeburnerSkillName && enumHas(value, ["Blade's Intuition", "Hyperdrive"])) bridge.enums.BladeburnerSkillName = value;
        }

        if (looksLikeUnmaskedFunction(value, "Trying to add a server with an existing")) {
          for (const [innerName, inner] of objectEntries(module)) {
            if (looksLikeUnmaskedFunction(inner, "?? null") || looksLikeUnmaskedFunction(inner, "??null")) {
              bridge.GetServer = inner;
              globalThis.GetServer = inner;
            }
            if (innerName === "GetAllServers" || innerName === "US" || isLikelyGetAllServers(inner)) {
              bridge.GetAllServers = inner;
            }
          }
        }
        if (typeof value === "function") classifyFunction(bridge, value, exportName);
      } catch (error) {
        bridge.errors.push("Skipped webpack export " + moduleId + ": " + String(error?.message ?? error));
      }
    }
    classifyDarknetModule(bridge, module);
    classifyCodingContractModule(bridge, module);
    classifySnackbarModule(bridge, module);
  }
  if (bridge.Router) globalThis.Router = bridge.Router;
  globalThis.__devMenuTestBridge = bridge;
  return bridge;
}

function classifyFunction(bridge, fn, exportName = "") {
  const code = safeFunctionSource(fn);
  if (!code) return;
  const add = (name) => {
    setBridgeFunc(bridge, name, fn);
  };
  const mappedFunc = DARKNET_FUNC_BY_EXPORT[exportName];
  if (mappedFunc) add(mappedFunc);
  if ([
    "serverFactory",
    "moveDarknetServer",
    "createDarknetServer",
    "addRandomDarknetServers",
    "moveRandomDarknetServers",
    "deleteRandomDarknetServers",
    "restartAllDarknetServers",
    "balanceDarknetServers",
    "validateDarknetNetwork",
    "clearDarknet",
    "populateDarknet",
    "launchWebstorm",
  ].includes(exportName)) add(exportName);
  const exportMappedType = DARKNET_CONFIG_BY_EXPORT[exportName];
  if (exportMappedType) bridge.darknetConfigBuilders[exportMappedType] = fn;
  if (!bridge.funcs.serverFactory && isLikelyDarknetServerFactory(fn)) add("serverFactory");
  if (!bridge.funcs.createDarknetServer && isLikelyCreateDarknetServer(fn, code)) add("createDarknetServer");
  if (!bridge.funcs.addRandomDarknetServers && isLikelyAddRandomDarknetServers(fn)) add("addRandomDarknetServers");
  if (!bridge.funcs.clearDarknet && isLikelyClearDarknet(fn)) add("clearDarknet");
  if (!bridge.funcs.populateDarknet && isLikelyPopulateDarknet(fn)) add("populateDarknet");
  for (const type of DARKNET_SERVER_TYPES) {
    if (type !== "RANDOM" && isCallableHelper(fn) && code.includes(type) && (code.includes("staticPasswordHint") || code.includes("passwordHintData") || code.includes("modelId"))) {
      bridge.darknetConfigBuilders[type] = fn;
    }
  }
  if (code.includes("Congruity Implant") || (code.includes("staticAugmentation") && code.includes("mergeMultipliers"))) add("applyAugmentation");
  if (code.includes("sourceFileLvl(10)") && code.includes("sleevesFromCovenant") && code.includes("new ")) add("recalculateSleeves");
  if (code.includes("checkForMessagesToSend") || (code.includes("Message") && code.includes("Red Pill"))) add("checkMessages");
  if (code.includes("DarkscapeNavigator.exe") && code.includes("populateDarknet")) add("getDarkscapeNavigator");
  if (isLikelyClearDarknet(fn)) add("clearDarknet");
  if (isLikelyPopulateDarknet(fn)) add("populateDarknet");
  if (code.includes("leftOffset") && code.includes("difficulty") && code.includes("depth") && code.includes("DnetServerBuilder")) add("serverFactory");
  if (code.includes("Something is trying to move darkweb") && code.includes("getAllOpenPositions")) add("moveDarknetServer");
  if (code.includes("MAX_PASSWORD_LENGTH") && code.includes("serverFactory")) add("createDarknetServer");
  if (code.includes("getAllMovableDarknetServers") && code.includes("moveDarknetServer") && code.includes("Math.random")) add("moveRandomDarknetServers");
  if (code.includes("createDarknetServer") && code.includes("moveDarknetServer") && code.includes("getNetDepth")) add("addRandomDarknetServers");
  if (code.includes("gainCharismaExp") && code.includes("addSessionToServer") && code.includes("hasAdminRights")) add("handleSuccessfulAuth");
  if (code.includes("Created") && code.includes("darknet") && code.includes("moveDarknetServer")) add("createDarknetServer");
  if (code.includes("Server restarted.") && code.includes("authenticatedPIDs")) add("restartDarknetServer");
  if (code.includes("violent") && code.includes("webstorm")) add("launchWebstorm");
  if (code.includes("DARKNET WEBSTORM APPROACHING")) add("launchWebstorm");
  if (exportName === "generateDummyContract") add("generateDummyContract");
  if (isLikelyGenerateDummyContract(fn)) add("generateDummyContract");
}

function classifyDarknetModule(bridge, module) {
  const entries = objectEntries(module).filter(([, value]) => typeof value === "function");
  if (!entries.length) return;
  const moduleCode = entries.map(([, fn]) => safeFunctionSource(fn)).join("\n");

  if (moduleCode.includes("staticPasswordHint") && (moduleCode.includes("The password is") || moduleCode.includes("passwordHintData"))) {
    for (const [exportName, fn] of entries) {
      const mapped = DARKNET_SERVER_GENERATOR_EXPORTS[exportName];
      if (mapped) setBridgeFunc(bridge, mapped, fn);
      if (!bridge.funcs.serverFactory && isLikelyDarknetServerFactory(fn)) setBridgeFunc(bridge, "serverFactory", fn);
      if (!bridge.funcs.createDarknetServer && isLikelyCreateDarknetServer(fn, moduleCode)) setBridgeFunc(bridge, "createDarknetServer", fn);
      const config = previewDarknetConfig(fn);
      if (config?.modelId && isCallableHelper(fn) && DARKNET_SERVER_TYPES.includes(config.modelId)) bridge.darknetConfigBuilders[config.modelId] = fn;
    }
  }

  if (moduleCode.includes("Something is trying to move darkweb")) {
    for (const [exportName, fn] of entries) {
      const code = safeFunctionSource(fn);
      const mapped = DARKNET_MOVEMENT_EXPORTS[exportName];
      if (mapped) setBridgeFunc(bridge, mapped, fn);
      if (!bridge.funcs.moveDarknetServer && code.includes("Something is trying to move darkweb")) setBridgeFunc(bridge, "moveDarknetServer", fn);
      if (!bridge.funcs.addRandomDarknetServers && isLikelyAddRandomDarknetServers(fn)) setBridgeFunc(bridge, "addRandomDarknetServers", fn);
      if (!bridge.funcs.restartDarknetServer && code.includes("Server restarted.")) setBridgeFunc(bridge, "restartDarknetServer", fn);
    }
  }

  if (moduleCode.includes("migrationInductionServers") || moduleCode.includes("Invalid darknet server instance detected")) {
    for (const [exportName, fn] of entries) {
      const mapped = DARKNET_NETWORK_GENERATOR_EXPORTS[exportName];
      if (mapped) setBridgeFunc(bridge, mapped, fn);
      if (!bridge.funcs.clearDarknet && isLikelyClearDarknet(fn)) setBridgeFunc(bridge, "clearDarknet", fn);
      if (!bridge.funcs.populateDarknet && isLikelyPopulateDarknet(fn)) setBridgeFunc(bridge, "populateDarknet", fn);
    }
  }

  if (moduleCode.includes("DARKNET WEBSTORM APPROACHING")) {
    for (const [exportName, fn] of entries) {
      const code = safeFunctionSource(fn);
      const mapped = DARKNET_WEBSTORM_EXPORTS[exportName];
      if (mapped) setBridgeFunc(bridge, mapped, fn);
      if (!bridge.funcs.launchWebstorm && code.includes("DARKNET WEBSTORM APPROACHING")) setBridgeFunc(bridge, "launchWebstorm", fn);
    }
  }
}

function classifyCodingContractModule(bridge, module) {
  const entries = objectEntries(module).filter(([, value]) => typeof value === "function");
  if (!entries.length) return;
  const moduleCode = entries.map(([, fn]) => safeFunctionSource(fn)).join("\n");
  if (!moduleCode.includes("Invalid problem type") || !moduleCode.includes("contract-") || !moduleCode.includes("rewardScaling")) return;
  for (const [exportName, fn] of entries) {
    const mapped = CODING_CONTRACT_GENERATOR_EXPORTS[exportName];
    if (mapped) setBridgeFunc(bridge, mapped, fn);
    if (!bridge.funcs.generateDummyContract && isLikelyGenerateDummyContract(fn)) setBridgeFunc(bridge, "generateDummyContract", fn);
  }
}

function classifySnackbarModule(bridge, module) {
  if (bridge.SnackbarEvents) return;
  const entries = objectEntries(module);
  const moduleCode = entries
    .filter(([, value]) => typeof value === "function")
    .map(([, fn]) => safeFunctionSource(fn))
    .join("\n");
  if (!moduleCode.includes("enqueueSnackbar") || !moduleCode.includes("autoHideDuration")) return;
  for (const [, value] of entries) {
    if (isEventEmitterObject(value)) {
      bridge.SnackbarEvents = value;
      return;
    }
  }
}

function setBridgeFunc(bridge, name, fn) {
  if (!bridge.funcs[name] && isCallableHelper(fn)) bridge.funcs[name] = fn;
}

function isCallableHelper(fn) {
  if (typeof fn !== "function") return false;
  return !safeFunctionSource(fn).trimStart().startsWith("class ");
}

function isEventEmitterObject(value) {
  return !!value
    && typeof value === "object"
    && typeof value.emit === "function"
    && typeof value.subscribe === "function";
}

function compactSource(source) {
  return String(source ?? "").replace(/\s+/g, "");
}

function isLikelyDarknetServerFactory(fn) {
  const code = safeFunctionSource(fn);
  return isCallableHelper(fn)
    && fn.length >= 4
    && code.includes("difficulty")
    && code.includes("depth")
    && code.includes("leftOffset");
}

function isLikelyCreateDarknetServer(fn, moduleCode) {
  const code = safeFunctionSource(fn);
  const compactCode = compactSource(code);
  const compactModule = compactSource(moduleCode);
  return isCallableHelper(fn)
    && fn.length === 3
    && (moduleCode.includes("staticPasswordHint") || compactModule.includes("staticPasswordHint") || compactCode.includes("-1,-1"))
    && (code.includes("Math.random") || compactCode.includes("-1,-1"))
    && !code.includes("Something is trying to move darkweb");
}

function isLikelyAddRandomDarknetServers(fn) {
  const code = safeFunctionSource(fn);
  const compactCode = compactSource(code);
  return isCallableHelper(fn)
    && compactCode.includes("-1,-1")
    && code.includes("Math.random")
    && !code.includes("Something is trying to move darkweb");
}

function isLikelyClearDarknet(fn) {
  const code = safeFunctionSource(fn);
  const compactCode = compactSource(code);
  return isCallableHelper(fn)
    && (
      (code.includes("stockPromotions") && code.includes("migrationInductionServers"))
      || (compactCode.includes("zoomIndex=7") && compactCode.includes("netViewLeftScroll=0") && compactCode.includes("netViewTopScroll=0"))
    );
}

function isLikelyPopulateDarknet(fn) {
  const code = safeFunctionSource(fn);
  const compactCode = compactSource(code);
  return isCallableHelper(fn)
    && compactCode.includes("Network[0].length")
    && compactCode.includes("Network[1].length")
    && (code.includes("Math.random") || compactCode.includes("Math.random"));
}

function isLikelyGetAllServers(fn) {
  const code = safeFunctionSource(fn);
  const compactCode = compactSource(code);
  return isCallableHelper(fn)
    && compactCode.includes(".entries())")
    && compactCode.includes("push(")
    && compactCode.includes("instanceof");
}

function isLikelyGenerateDummyContract(fn) {
  const code = safeFunctionSource(fn);
  return isCallableHelper(fn)
    && code.includes("Invalid problem type")
    && code.includes("addContract")
    && code.includes("null");
}

function previewDarknetConfig(fn) {
  if (!isCallableHelper(fn) || fn.length > 1) return null;
  const code = safeFunctionSource(fn);
  const compactCode = compactSource(code);
  if (!isLikelyDarknetConfigBuilderSource(code, compactCode)) return null;
  try {
    const result = fn(3);
    if (!result || typeof result !== "object") return null;
    if (typeof result.modelId !== "string" || typeof result.password !== "string" || typeof result.staticPasswordHint !== "string") return null;
    return result;
  } catch {
    return null;
  }
}

function isLikelyDarknetConfigBuilderSource(code, compactCode = compactSource(code)) {
  return compactCode.includes("return{")
    && compactCode.includes("modelId:")
    && compactCode.includes("password:")
    && compactCode.includes("staticPasswordHint:")
    && !compactCode.includes("-1,-1")
    && !code.includes("PasswordResponse")
    && !code.includes("console.error")
    && !code.includes("TypeAssertion")
    && !code.includes("AddToAllServers")
    && !code.includes("Something is trying");
}

function enumHas(object, values) {
  const all = Object.values(object);
  return values.every((value) => all.includes(value));
}

function isPlayerObject(value) {
  return !!value
    && typeof value === "object"
    && typeof value.gainMoney === "function"
    && typeof value.getHomeComputer === "function"
    && typeof value.updateSkillLevels === "function"
    && "queuedAugmentations" in value
    && "sourceFiles" in value;
}

function isFactionsObject(value) {
  return !!value
    && typeof value === "object"
    && isFactionRecordObject(value.Illuminati);
}

function isCompaniesObject(value) {
  return !!value
    && typeof value === "object"
    && isCompanyRecordObject(value.ECorp);
}

function isFactionRecordObject(value) {
  return !!value
    && typeof value === "object"
    && typeof value.name === "string"
    && typeof value.setFavor === "function"
    && Array.isArray(value.augmentations)
    && "playerReputation" in value
    && "discovery" in value
    && "alreadyInvited" in value
    && !("companyPositions" in value);
}

function isCompanyRecordObject(value) {
  return !!value
    && typeof value === "object"
    && typeof value.name === "string"
    && typeof value.setFavor === "function"
    && "playerReputation" in value
    && "companyPositions" in value
    && typeof value.hasPosition === "function"
    && "salaryMultiplier" in value
    && "expMultiplier" in value
    && "jobStatReqOffset" in value;
}

function isEngineObject(value) {
  return !!value
    && typeof value === "object"
    && typeof value.updateGame === "function"
    && value.Counters
    && "achievementsCounter" in value.Counters
    && "_lastUpdate" in value;
}

function isNodeMultObject(value) {
  return !!value
    && typeof value === "object"
    && "HackingLevelMultiplier" in value
    && "StrengthLevelMultiplier" in value
    && "WorldDaemonDifficulty" in value;
}

function isAchievementsObject(value) {
  if (!value || typeof value !== "object") return false;
  const items = Object.values(value);
  return items.length > 25 && items.some((item) => item?.ID && item?.Name && item?.Description);
}

function isAugmentationsObject(value) {
  if (!value || typeof value !== "object") return false;
  const items = objectValues(value).filter(isAugmentationObject);
  return items.length > 50 && items.some((item) => item.name === "Wired Reflexes") && items.some((item) => item.name === "NeuroFlux Governor");
}

function isAugmentationObject(value) {
  return !!value
    && typeof value === "object"
    && typeof value.name === "string"
    && value.mults
    && typeof value.mults === "object"
    && Array.isArray(value.prereqs)
    && "isSpecial" in value
    && "baseCost" in value;
}

function isStockMarketObject(value) {
  if (!value || typeof value !== "object") return false;
  const stocks = Object.values(value).filter((stock) => stock && typeof stock === "object" && "symbol" in stock && "price" in stock && "cap" in stock);
  return stocks.length > 10;
}

function isStanekObject(value) {
  return !!value
    && typeof value === "object"
    && "storedCycles" in value
    && value.fragments
    && typeof value.fragments.forEach === "function";
}

function isDarknetState(value) {
  return !!value
    && typeof value === "object"
    && Array.isArray(value.Network)
    && "showFullNetwork" in value
    && "storedCycles" in value;
}

function safeNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function formatNumber(value, digits = 2) {
  if (value === Infinity) return "Infinity";
  if (value === -Infinity) return "-Infinity";
  if (!Number.isFinite(Number(value))) return String(value);
  const abs = Math.abs(value);
  if (abs >= 1e15) return (value / 1e15).toFixed(digits) + "q";
  if (abs >= 1e12) return (value / 1e12).toFixed(digits) + "t";
  if (abs >= 1e9) return (value / 1e9).toFixed(digits) + "b";
  if (abs >= 1e6) return (value / 1e6).toFixed(digits) + "m";
  if (abs >= 1e3) return (value / 1e3).toFixed(digits) + "k";
  return Number(value).toFixed(abs >= 10 ? 0 : digits);
}

function formatMoney(value) {
  return "$" + formatNumber(value);
}

function formatRam(gb) {
  if (!Number.isFinite(gb)) return String(gb);
  if (gb >= 1073741824) return formatNumber(gb / 1073741824) + "EB";
  if (gb >= 1048576) return formatNumber(gb / 1048576) + "PB";
  if (gb >= 1024) return formatNumber(gb / 1024) + "TB";
  return formatNumber(gb) + "GB";
}

function notify(text, variant = "info") {
  try {
    let bridge = globalThis.__devMenuTestBridge ?? discoverGameObjects();
    if (!bridge?.SnackbarEvents) bridge = discoverGameObjects(true);
    bridge?.SnackbarEvents?.emit?.(String(text), variant, 2500);
  } catch { }
}

function getHome(player) {
  try {
    return player?.getHomeComputer?.();
  } catch {
    return undefined;
  }
}
function normalizeSourceFiles(resetInfo) {
  const ownedSF = resetInfo?.ownedSF;
  if (ownedSF instanceof Map) return [...ownedSF.entries()].map(([n, lvl]) => ({ n, lvl }));
  return [];
}

function getResetInfoFromPlayer(player) {
  const bitNodeOptions = player?.bitNodeOptions ?? {};
  const activeSourceFiles = player?.activeSourceFiles instanceof Map
    ? player.activeSourceFiles
    : player?.sourceFiles instanceof Map ? player.sourceFiles : new Map();
  return {
    lastAugReset: player?.lastAugReset ?? 0,
    lastNodeReset: player?.lastNodeReset ?? 0,
    currentNode: player?.bitNodeN ?? 1,
    ownedAugs: new Map((player?.augmentations ?? []).map((aug) => [aug.name, aug.level])),
    ownedSF: new Map([...activeSourceFiles].filter(([, activeLevel]) => activeLevel > 0)),
    bitNodeOptions: {
      ...bitNodeOptions,
      sourceFileOverrides: new Map(bitNodeOptions.sourceFileOverrides ?? []),
    },
  };
}
function hasBN(resetInfo, sourceFiles, bn, sfLvl = 1) {
  if (bn === true && sfLvl === true) return true;
  if (bn === false && sfLvl === false) return false;
  if (resetInfo?.currentNode === bn) return true;
  for (const sf of sourceFiles ?? []) if (sf.n === bn && sf.lvl >= sfLvl) return true;
  return false;
}

function sourceFileLevel(player, sourceFiles, n) {
  if (typeof player?.sourceFileLvl === "function") return player.sourceFileLvl(n);
  const sf = (sourceFiles ?? []).find((item) => item.n === n);
  return sf?.lvl ?? 0;
}

function rowUnlocked(row, snapshot) {
  if (typeof row.gate === "function") return !!row.gate(snapshot);
  if (row.bn === true && row.lvl === true) return true;
  if (row.bn === 6) return hasBN(snapshot.resetInfo, snapshot.sourceFiles, 6, row.lvl) || hasBN(snapshot.resetInfo, snapshot.sourceFiles, 7, row.lvl);
  return hasBN(snapshot.resetInfo, snapshot.sourceFiles, row.bn, row.lvl);
}

function getAllServers(game) {
  if (typeof game.GetAllServers === "function") {
    const all = game.GetAllServers(true);
    if (Array.isArray(all) && all.length) return all;
  }
  const getSvr = game.GetServer;
  if (typeof getSvr !== "function") return [];
  const seen = new Set();
  const servers = [];
  const queue = ["home", "darkweb", "w0r1d_d43m0n"];
  while (queue.length) {
    const hostname = queue.shift();
    if (!hostname || seen.has(hostname)) continue;
    seen.add(hostname);
    let server;
    try {
      server = getSvr(hostname);
    } catch {
      server = null;
    }
    if (!server) continue;
    servers.push(server);
    for (const next of server.serversOnNetwork ?? []) if (!seen.has(next)) queue.push(next);
  }
  return servers;
}

function objectValues(record) {
  try {
    return record && (typeof record === "object" || typeof record === "function") ? Object.values(record) : [];
  } catch {
    return [];
  }
}

function objectEntries(record) {
  try {
    return record && (typeof record === "object" || typeof record === "function") ? Object.entries(record) : [];
  } catch {
    return [];
  }
}

function pushProgram(home, name) {
  if (!home || !name) return;
  if (home.pushProgram) {
    home.pushProgram(name);
    return;
  }
  home.programs ??= [];
  if (!home.programs.includes(name)) home.programs.push(name);
}

function uniqueSorted(values) {
  return [...new Set(values.filter((value) => value !== undefined && value !== null && value !== ""))].sort((a, b) => String(a).localeCompare(String(b)));
}

function getAugmentations(game) {
  const enumAugs = objectValues(game.enums?.AugmentationName);
  const factionAugs = getFactionObjects(game).flatMap((faction) => faction?.augmentations ?? []);
  const augObjects = getAugmentationObjects(game).map((aug) => aug.name);
  return uniqueSorted([...enumAugs, ...factionAugs, ...augObjects, ...DEFAULT_AUGS]);
}

function getPrograms(game) {
  return uniqueSorted([...objectValues(game.enums?.CompletedProgramName), ...DEFAULT_PROGRAMS]);
}

function getContractTypes(game) {
  return uniqueSorted([...objectValues(game.enums?.CodingContractName), ...DEFAULT_CONTRACT_TYPES]);
}

function getBladeSkills(game) {
  return uniqueSorted([...objectValues(game.enums?.BladeburnerSkillName), ...DEFAULT_BLADE_SKILLS]);
}

function getAugmentationObjects(game) {
  return objectValues(game.Augmentations).filter(isAugmentationObject);
}

function getStocks(game) {
  return objectValues(game.StockMarket).filter((stock) => stock && typeof stock === "object" && "symbol" in stock && "price" in stock);
}

function getFactionObjects(game) {
  return objectValues(game.Factions).filter(isFactionRecordObject);
}

function getCompanyObjects(game) {
  return objectValues(game.Companies).filter(isCompanyRecordObject);
}

function currentBN(resetInfo, sourceFiles) {
  const n = resetInfo?.currentNode ?? "?";
  const level = sourceFiles?.find((sf) => sf.n === n)?.lvl ?? 0;
  return "BN" + n + (level ? " / SF" + n + "." + level : "");
}

async function buildSnapshot() {
  exposeInternalGameObjects();
  const game = discoverGameObjects();
  const player = game.Player;
  const resetInfo = getResetInfoFromPlayer(player);
  const sourceFiles = normalizeSourceFiles(resetInfo);
  const servers = getAllServers(game);
  const home = getHome(player);
  const factionObjects = getFactionObjects(game);
  const companyObjects = getCompanyObjects(game);
  const factions = uniqueSorted(factionObjects.map((faction) => faction?.name));
  const companies = uniqueSorted(companyObjects.map((company) => company?.name));
  const stockSymbols = getStocks(game).map((stock) => stock.symbol).sort();
  return {
    game,
    player,
    home,
    resetInfo,
    sourceFiles,
    servers,
    factionObjects,
    companyObjects,
    serverNames: servers.map((server) => server.hostname).sort(),
    factions,
    companies,
    programs: getPrograms(game),
    augmentations: getAugmentations(game),
    contractTypes: getContractTypes(game),
    bladeSkills: getBladeSkills(game),
    stockSymbols,
    hasBridge: !!player,
    bnLabel: currentBN(resetInfo, sourceFiles),
    hasStockMarket: !!player["hasWseAccount"] || !!player["hasTixApiAccess"] || !!player["has4SData"] || !!player["has4SDataTixApi"] || resetInfo?.currentNode === 8 || hasBN(resetInfo, sourceFiles, 8),
    hasStanek: hasOwnedOrQueuedAug(player, "Stanek's Gift - Genesis") || hasOwnedOrQueuedAug(player, "Stanek's Gift - Awakening") || hasOwnedOrQueuedAug(player, "Stanek's Gift - Serenity"),
    hasDarknet: home?.programs?.includes("DarkscapeNavigator.exe") || resetInfo?.currentNode === 15 || hasBN(resetInfo, sourceFiles, 15),
  };
}

function hasOwnedOrQueuedAug(player, name) {
  return !!player?.augmentations?.some((aug) => aug.name === name)
    || !!player?.queuedAugmentations?.some((aug) => aug.name === name);
}

function loadSettings() {
  return {
    viewMode: menuState.viewMode,
    selectedRows: [...menuState.selectedRows],
    hiddenRows: [...menuState.hiddenRows],
  };
}

function saveSettings(settings) {
  menuState.viewMode = settings.viewMode ?? defaultMenuState.viewMode;
  menuState.selectedRows = [...(settings.selectedRows ?? defaultMenuState.selectedRows)];
  menuState.hiddenRows = [...(settings.hiddenRows ?? defaultMenuState.hiddenRows)];
}

function resetSettings() {
  menuState.viewMode = defaultMenuState.viewMode;
  menuState.selectedRows = [...defaultMenuState.selectedRows];
  menuState.hiddenRows = [...defaultMenuState.hiddenRows];
  openDB.clear();
  return loadSettings();
}

function DevMenuApp() {
  const React = getReactLib();
  const saved = loadSettings();
  const [snapshot, setSnapshot] = React.useState(null);
  const [viewMode, setViewMode] = React.useState(saved.viewMode ?? "Mini");
  const [selectedRows, setSelectedRows] = React.useState(saved.selectedRows ?? ["General", "Servers", "Source-Files"]);
  const [hiddenRows, setHiddenRows] = React.useState(saved.hiddenRows ?? []);
  const [status, setStatus] = React.useState("");
  const [toolbarOpen, setToolbarOpen] = React.useState("");
  const [rowVersion, setRowVersion] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    let timer;
    const tick = async () => {
      const next = await buildSnapshot();
      if (!cancelled) setSnapshot(next);
      if (!cancelled) timer = setTimeout(tick, 400);
    };
    timer = setTimeout(tick, 80);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  React.useEffect(() => {
    saveSettings({ viewMode, selectedRows, hiddenRows });
  }, [viewMode, selectedRows, hiddenRows]);

  const runAction = async (action, label = "Action") => {
    try {
      const result = await action();
      const text = result ? String(result) : label + " complete";
      setStatus(text);
      notify(text, "success");
    } catch (error) {
      const text = label + " failed: " + String(error?.message ?? error);
      setStatus(text);
      notify(text, "error");
    }
    setSnapshot(await buildSnapshot());
  };

  if (!snapshot) return <div>{"Loading Dev Menu Test..."}</div>;
  if (!snapshot.hasBridge) {
    return (
      <div style={topPanelWrapStyle}>
        <div style={topPanelTitleStyle}>{"SphyxOS Dev Menu"}</div>
        <div style={topPanelMetaStyle}>{"The webpack bridge did not find Player. Try closing and rerunning after the game has fully loaded."}</div>
        <button style={displaySecondaryStyle} onClick={() => runAction(() => {
          exposeInternalGameObjects(true);
          return "Webpack bridge rescanned";
        }, "Rescan")}>{"Rescan Webpack"}</button>
      </div>
    );
  }

  const rows = buildRows(snapshot, runAction, setStatus);
  const availableRows = rows.filter((row) => rowUnlocked(row, snapshot) && !hiddenRows.includes(row.title));
  const hasCorpAccess = !!snapshot.player.corporation || hasBN(snapshot.resetInfo, snapshot.sourceFiles, 3, 3);
  const hasGangAccess = !!snapshot.player.gang || hasBN(snapshot.resetInfo, snapshot.sourceFiles, 2);
  const hasBladeburnerAccess = !!snapshot.player.bladeburner || hasBN(snapshot.resetInfo, snapshot.sourceFiles, 6) || hasBN(snapshot.resetInfo, snapshot.sourceFiles, 7);
  const hasSleeveAccess = (snapshot.player.sleeves?.length ?? 0) > 0 || hasBN(snapshot.resetInfo, snapshot.sourceFiles, 10);
  const toggleSelected = (title) => setSelectedRows((current) => current.includes(title) ? current.filter((row) => row !== title) : [...current, title]);
  const hideRow = (title) => {
    setHiddenRows((current) => current.includes(title) ? current : [...current, title]);
    setSelectedRows((current) => current.filter((row) => row !== title));
    setRowVersion((value) => value + 1);
  };
  const unhideAll = () => {
    setHiddenRows([]);
    setRowVersion((value) => value + 1);
  };

  return (
    <div style={appStyle} onMouseDownCapture={(event) => {
      if (!toolbarOpen) return;
      if (!event.target.closest?.("[data-toolbar-menu='true']")) setToolbarOpen("");
    }}>
      <div data-row="Display" style={topPanelWrapStyle}>
        <div style={topPanelInfoStyle}>
          <div>
            <div style={topPanelTitleStyle}>{"SphyxOS Dev Menu"}</div>
            <div style={topPanelMetaStyle}>{snapshot.bnLabel + " | Money " + formatMoney(snapshot.player.money ?? 0) + " | Home RAM " + formatRam(snapshot.home?.maxRam ?? 0)}</div>
            <div style={topPanelMetaStyle}>{"Internal bridge: " + Object.keys(snapshot.game.funcs ?? {}).length + " helper functions found"}</div>
          </div>
          <div style={displayStatusTrayStyle}>
            {hasCorpAccess ? <span style={displayStatusMutedStyle}>{snapshot.player.corporation ? "Corp" : "No Corp"}</span> : null}
            {hasGangAccess ? <span style={displayStatusMutedStyle}>{snapshot.player.gang ? "Gang" : "No Gang"}</span> : null}
            {hasBladeburnerAccess ? <span style={displayStatusMutedStyle}>{snapshot.player.bladeburner ? "Bladeburner" : "No Bladeburner"}</span> : null}
            {hasSleeveAccess ? <span style={displayStatusMutedStyle}>{(snapshot.player.sleeves?.length ?? 0) + " Sleeves"}</span> : null}
            <button data-nohover="true" style={hiddenRows.length > 0 ? displayStatusWarnStyle : displayStatusMutedStyle} onClick={unhideAll}>{"Hidden " + hiddenRows.length}</button>
          </div>
        </div>
        <div style={toolbarBarStyle}>
          <div style={toolbarMenuStyle} data-toolbar-menu="true">
            <button style={toolbarOpen === "actions" ? toolbarSummaryOpenStyle : toolbarSummaryStyle} onClick={() => setToolbarOpen(toolbarOpen === "actions" ? "" : "actions")}>{"Actions"}</button>
            {toolbarOpen === "actions" && <div style={toolbarDropdownStyle}>
              <div style={toolbarSectionTitleStyle}>{"System"}</div>
              <button style={displaySecondaryStyle} onClick={() => runAction(() => {
                exposeInternalGameObjects(true);
                return "Webpack bridge rescanned";
              }, "Rescan")}>{"Rescan Webpack"}</button>
              <button style={displaySecondaryStyle} onClick={() => runAction(() => {
                globalThis.openDevMenu?.();
                return "Native dev menu requested";
              }, "Open Native Dev Menu")}>{"Open Native Dev Menu"}</button>
              <button style={displayDangerStyle} onClick={() => runAction(() => {
                const next = resetSettings();
                setViewMode(next.viewMode);
                setSelectedRows(next.selectedRows);
                setHiddenRows(next.hiddenRows);
                setRowVersion((value) => value + 1);
                return "Menu layout reset";
              }, "Reset Layout")}>{"Reset Layout"}</button>
            </div>}
          </div>
          <div style={viewModeToggleWrapStyle}>
            <span style={viewModeLabelStyle}>{"View:"}</span>
            <button data-nohover="true" style={viewMode === "Mini" ? viewModeMiniActiveStyle : viewModeButtonActiveStyle} onClick={() => setViewMode(viewMode === "Mini" ? "Standard" : "Mini")}>{viewMode}</button>
          </div>
          <span style={toolbarHintStyle}>{status}</span>
        </div>
      </div>

      {viewMode === "Mini"
        ? <MiniView rows={availableRows} selectedRows={selectedRows} onToggleRow={toggleSelected} onHideToggle={hideRow} rowVersion={rowVersion}></MiniView>
        : availableRows.map((row) => <Row key={row.title + "-" + rowVersion} row={row} onHideToggle={hideRow}></Row>)}
    </div>
  );
}

function makeSummary(snapshot) {
  return {
    bitNode: snapshot.bnLabel,
    money: snapshot.player.money,
    homeRam: snapshot.home?.maxRam,
    sourceFiles: snapshot.sourceFiles,
    corporation: !!snapshot.player.corporation,
    gang: snapshot.player.gang?.facName ?? null,
    bladeburner: !!snapshot.player.bladeburner,
    sleeves: snapshot.player.sleeves?.length ?? 0,
    servers: snapshot.servers.length,
    modulesFound: snapshot.game.modules?.length ?? 0,
    helperFunctions: Object.keys(snapshot.game.funcs ?? {}),
  };
}

function buildRows(snapshot, runAction, setStatus) {
  const React = getReactLib();
  const game = snapshot.game;
  const player = snapshot.player;
  const home = snapshot.home;
  const rows = [];

  rows.push({
    title: "General",
    bn: true,
    lvl: true,
    body: <GeneralTools snapshot={snapshot} runAction={runAction}></GeneralTools>,
  });
  rows.push({
    title: "Experience / Stats",
    bn: true,
    lvl: true,
    body: <StatsTools snapshot={snapshot} runAction={runAction}></StatsTools>,
  });
  rows.push({
    title: "Factions",
    bn: true,
    lvl: true,
    body: <FactionTools snapshot={snapshot} runAction={runAction}></FactionTools>,
  });
  rows.push({
    title: "Augmentations",
    bn: true,
    lvl: true,
    body: <AugmentationTools snapshot={snapshot} runAction={runAction}></AugmentationTools>,
  });
  rows.push({
    title: "Source-Files",
    bn: true,
    lvl: true,
    body: <SourceFileTools snapshot={snapshot} runAction={runAction}></SourceFileTools>,
  });
  rows.push({
    title: "Programs",
    bn: true,
    lvl: true,
    body: <ProgramTools snapshot={snapshot} runAction={runAction}></ProgramTools>,
  });
  rows.push({
    title: "Servers",
    bn: true,
    lvl: true,
    body: <ServerTools snapshot={snapshot} runAction={runAction}></ServerTools>,
  });
  rows.push({
    title: "Companies",
    bn: true,
    lvl: true,
    body: <CompanyTools snapshot={snapshot} runAction={runAction}></CompanyTools>,
  });
  rows.push({
    title: "Bladeburner",
    bn: 6,
    lvl: 1,
    gate: (snap) => !!snap.player.bladeburner || hasBN(snap.resetInfo, snap.sourceFiles, 6) || hasBN(snap.resetInfo, snap.sourceFiles, 7),
    body: <BladeburnerTools snapshot={snapshot} runAction={runAction}></BladeburnerTools>,
  });
  rows.push({
    title: "Gang",
    bn: 2,
    lvl: 1,
    gate: (snap) => !!snap.player.gang || hasBN(snap.resetInfo, snap.sourceFiles, 2),
    body: <GangTools snapshot={snapshot} runAction={runAction}></GangTools>,
  });
  rows.push({
    title: "Corporation",
    bn: 3,
    lvl: 3,
    gate: (snap) => !!snap.player.corporation || hasBN(snap.resetInfo, snap.sourceFiles, 3, 3),
    body: <CorporationTools snapshot={snapshot} runAction={runAction}></CorporationTools>,
  });
  rows.push({
    title: "Coding Contracts",
    bn: true,
    lvl: true,
    body: <CodingContractTools snapshot={snapshot} runAction={runAction}></CodingContractTools>,
  });
  rows.push({
    title: "Stock Market",
    bn: true,
    lvl: true,
    gate: (snap) => snap.hasStockMarket,
    body: <StockTools snapshot={snapshot} runAction={runAction} setStatus={setStatus}></StockTools>,
  });
  rows.push({
    title: "Sleeves",
    bn: 10,
    lvl: 1,
    gate: (snap) => (snap.player.sleeves?.length ?? 0) > 0 || hasBN(snap.resetInfo, snap.sourceFiles, 10),
    body: <SleeveTools snapshot={snapshot} runAction={runAction}></SleeveTools>,
  });
  rows.push({
    title: "Stanek's Gift",
    bn: 13,
    lvl: 1,
    gate: (snap) => snap.hasStanek || hasBN(snap.resetInfo, snap.sourceFiles, 13),
    body: <StanekTools snapshot={snapshot} runAction={runAction}></StanekTools>,
  });
  rows.push({
    title: "Time Skip",
    bn: true,
    lvl: true,
    body: <TimeSkipTools snapshot={snapshot} runAction={runAction}></TimeSkipTools>,
  });
  rows.push({
    title: "Achievements",
    bn: true,
    lvl: true,
    body: <AchievementTools snapshot={snapshot} runAction={runAction}></AchievementTools>,
  });
  rows.push({
    title: "Entropy",
    bn: true,
    lvl: true,
    body: <EntropyTools snapshot={snapshot} runAction={runAction}></EntropyTools>,
  });
  rows.push({
    title: "Darknet",
    bn: 15,
    lvl: 1,
    gate: (snap) => snap.hasDarknet || hasBN(snap.resetInfo, snap.sourceFiles, 15),
    body: <DarknetTools snapshot={snapshot} runAction={runAction}></DarknetTools>,
  });
  return rows;
}

function GeneralTools({ snapshot, runAction }) {
  const React = getReactLib();
  const [money, setMoney] = React.useState("1000000000");
  const [hashes, setHashes] = React.useState("100");
  const [corpName, setCorpName] = React.useState("DevCorp");
  const [gangFaction, setGangFaction] = React.useState(DEFAULT_GANG_FACTIONS[0]);
  const player = snapshot.player;
  const home = snapshot.home;
  const hashManager = player.hashManager;
  const hasCorpAccess = !!player.corporation || hasBN(snapshot.resetInfo, snapshot.sourceFiles, 3, 3);
  const hasGangAccess = !!player.gang || hasBN(snapshot.resetInfo, snapshot.sourceFiles, 2);
  const hasBladeburnerAccess = !!player.bladeburner || hasBN(snapshot.resetInfo, snapshot.sourceFiles, 6) || hasBN(snapshot.resetInfo, snapshot.sourceFiles, 7);
  return (
    <span>
      <Line label={"Money: " + formatMoney(player.money ?? 0)}>
        {[1e6, 1e9, 1e12, 1e15, Infinity].map((value) => <ActionButton key={String(value)} text={"+" + formatMoney(value)} onClick={() => runAction(() => {
          player.gainMoney(value, "other");
          return "Added " + formatMoney(value);
        }, "Add money")}></ActionButton>)}
        <input style={inputStyle} value={money} onChange={(event) => setMoney(event.target.value)}></input>
        <ActionButton text={"Give"} onClick={() => runAction(() => {
          player.gainMoney(safeNumber(money), "other");
          return "Added " + formatMoney(safeNumber(money));
        }, "Give money")}></ActionButton>
        <ActionButton text={"Set"} onClick={() => runAction(() => {
          player.money = safeNumber(money);
          return "Money set";
        }, "Set money")}></ActionButton>
        <ActionButton text={"Clear"} onClick={() => runAction(() => {
          player.money = 0;
          return "Money cleared";
        }, "Clear money")}></ActionButton>
      </Line>
      {hashManager?.capacity > 0 && <Line label={"Hashes: " + formatNumber(hashManager.hashes ?? 0) + " / " + formatNumber(hashManager.capacity ?? 0)}>
        <input style={inputStyle} value={hashes} onChange={(event) => setHashes(event.target.value)}></input>
        <ActionButton text={"Give Hashes"} onClick={() => runAction(() => {
          hashManager.storeHashes?.(safeNumber(hashes));
          if (!hashManager.storeHashes) hashManager.hashes = safeNumber(hashes);
          return "Hashes added";
        }, "Give hashes")}></ActionButton>
        <ActionButton text={"Clear Hashes"} onClick={() => runAction(() => {
          hashManager.hashes = 0;
          return "Hashes cleared";
        }, "Clear hashes")}></ActionButton>
      </Line>}
      <Line label={"Max Home RAM: " + formatRam(home?.maxRam ?? 0)}>
        {[8, 64, 1024, 1048576, 1073741824].map((gb) => <ActionButton key={gb} text={formatRam(gb)} onClick={() => runAction(() => {
          home.maxRam = gb;
          return "Home RAM set to " + formatRam(gb);
        }, "Set RAM")}></ActionButton>)}
        <ActionButton text={"RAM *= 2"} onClick={() => runAction(() => {
          home.maxRam *= 2;
          return "Home RAM doubled";
        }, "Double RAM")}></ActionButton>
      </Line>
      {hasCorpAccess ? <Line label={"Corporation:"}>
        {player.corporation
          ? <ActionButton text={"Destroy Corporation"} style={redStyle} onClick={() => runAction(() => {
            player.corporation = null;
            return "Corporation destroyed";
          }, "Destroy corporation")}></ActionButton>
          : <span><input style={inputStyle} value={corpName} onChange={(event) => setCorpName(event.target.value)}></input><ActionButton text={"Create Corporation"} onClick={() => runAction(() => {
            player.startCorporation?.(corpName || "DevCorp", false);
            return "Corporation created";
          }, "Create corporation")}></ActionButton></span>}
      </Line> : null}
      {hasGangAccess ? <Line label={"Gang:"}>
        {player.gang
          ? <ActionButton text={"Leave Gang"} style={redStyle} onClick={() => runAction(() => {
            player.gang = null;
            return "Gang removed";
          }, "Leave gang")}></ActionButton>
          : <span><SelectBox value={gangFaction} options={DEFAULT_GANG_FACTIONS} onChange={setGangFaction}></SelectBox><ActionButton text={"Create Gang"} onClick={() => runAction(() => {
            player.startGang?.(gangFaction, gangFaction === "NiteSec" || gangFaction === "The Black Hand");
            return "Gang created";
          }, "Create gang")}></ActionButton></span>}
      </Line> : null}
      {hasBladeburnerAccess ? <Line label={"Bladeburner:"}>
        {player.bladeburner
          ? <ActionButton text={"Leave Bladeburner"} style={redStyle} onClick={() => runAction(() => {
            player.bladeburner = null;
            return "Bladeburner removed";
          }, "Leave Bladeburner")}></ActionButton>
          : <ActionButton text={"Join Bladeburner"} onClick={() => runAction(() => {
            player.startBladeburner?.();
            return "Joined Bladeburner";
          }, "Join Bladeburner")}></ActionButton>}
      </Line> : null}
      <Line label={"Node:"}>
        <ActionButton text={"Quick b1t_flum3"} onClick={() => runAction(() => {
          snapshot.game.Router?.toPage?.("BitVerse", { flume: true, quick: true });
          return "Quick b1t_flum3 requested";
        }, "Quick b1t_flum3")}></ActionButton>
        <ActionButton text={"Run b1t_flum3"} onClick={() => runAction(() => {
          snapshot.game.Router?.toPage?.("BitVerse", { flume: true, quick: false });
          return "b1t_flum3 requested";
        }, "Run b1t_flum3")}></ActionButton>
        <ActionButton text={"Quick w0rld_d34m0n"} onClick={() => runAction(() => {
          const wd = snapshot.game.GetServer?.("w0r1d_d43m0n");
          if (wd) wd.backdoorInstalled = true;
          snapshot.game.Router?.toPage?.("BitVerse", { flume: false, quick: true });
          return "Quick w0rld_d34m0n requested";
        }, "Quick WD")}></ActionButton>
        <ActionButton text={"Hack w0rld_d34m0n"} onClick={() => runAction(() => {
          const wd = snapshot.game.GetServer?.("w0r1d_d43m0n");
          if (wd) wd.backdoorInstalled = true;
          snapshot.game.Router?.toPage?.("BitVerse", { flume: false, quick: false });
          return "w0rld_d34m0n requested";
        }, "Hack WD")}></ActionButton>
      </Line>
      <Line label={"Misc:"}>
        <ActionButton text={"Check Messages"} onClick={() => runAction(() => {
          snapshot.game.funcs.checkMessages?.();
          return snapshot.game.funcs.checkMessages ? "Message check requested" : "Message helper was not found";
        }, "Check messages")}></ActionButton>
        <ActionButton text={"Open Native Menu"} onClick={() => runAction(() => {
          globalThis.openDevMenu?.();
          return "Native dev menu requested";
        }, "Open native menu")}></ActionButton>
        <ActionButton text={"Throw Error"} style={redStyle} onClick={() => {
          throw new Error("Manually thrown from Dev Menu Test");
        }}></ActionButton>
      </Line>
    </span>
  );
}

function StatsTools({ snapshot, runAction }) {
  const React = getReactLib();
  const [allLevel, setAllLevel] = React.useState("100");
  const player = snapshot.player;
  return (
    <span>
      <Line label={"All:"}>
        <ActionButton text={"Tons of exp"} onClick={() => runAction(() => {
          for (const [, , gainMethod] of STATS) player[gainMethod]?.(BIG);
          player.updateSkillLevels?.();
          return "Tons of exp added";
        }, "Tons of exp")}></ActionButton>
        <ActionButton text={"Reset"} style={redStyle} onClick={() => runAction(() => {
          for (const [, key] of STATS) player.exp[key] = 0;
          if (player.persistentIntelligenceData) player.persistentIntelligenceData.exp = 0;
          player.updateSkillLevels?.();
          return "All exp reset";
        }, "Reset exp")}></ActionButton>
        <input style={inputStyle} title={"level for all stats"} placeholder={"level"} type="number" value={allLevel} onChange={(event) => setAllLevel(event.target.value)}></input>
        <ActionButton text={"Set All"} onClick={() => runAction(() => {
          for (const stat of STATS.filter((item) => item[1] !== "intelligence")) setStatLevel(snapshot, stat, safeNumber(allLevel, 1));
          return "Normal stats set";
        }, "Set all stats")}></ActionButton>
      </Line>
      {STATS.map((stat) => <StatRow key={stat[0]} snapshot={snapshot} stat={stat} runAction={runAction}></StatRow>)}
      <Line label={"Karma:"}>
        <Adjuster label={"karma"} placeholder={"amt"} tons={() => runAction(() => {
          player.karma += -54000;
          return "Karma lowered";
        }, "Karma tons")} add={(value) => runAction(() => {
          player.karma += value;
          return "Karma added";
        }, "Add karma")} subtract={(value) => runAction(() => {
          player.karma -= value;
          return "Karma subtracted";
        }, "Subtract karma")} reset={() => runAction(() => {
          player.karma = 0;
          return "Karma reset";
        }, "Reset karma")}></Adjuster>
      </Line>
    </span>
  );
}

function StatRow({ snapshot, stat, runAction }) {
  const React = getReactLib();
  const [level, setLevel] = React.useState("100");
  const player = snapshot.player;
  const [label, key, gainMethod] = stat;
  return (
    <Line label={label + ": " + (player.skills?.[key] ?? 0)}>
      <Adjuster label={"exp"} placeholder={"exp"} tons={() => runAction(() => {
        player[gainMethod]?.(BIG);
        player.updateSkillLevels?.();
        return label + " exp added";
      }, label + " tons")} add={(value) => runAction(() => {
        player[gainMethod]?.(value);
        player.updateSkillLevels?.();
        return label + " exp added";
      }, "Add " + label)} subtract={(value) => runAction(() => {
        player[gainMethod]?.(-value);
        player.updateSkillLevels?.();
        return label + " exp subtracted";
      }, "Subtract " + label)} reset={() => runAction(() => {
        player.exp[key] = 0;
        if (key === "intelligence" && player.persistentIntelligenceData) player.persistentIntelligenceData.exp = 0;
        player.updateSkillLevels?.();
        return label + " reset";
      }, "Reset " + label)}></Adjuster>
      <input style={smallInputStyle} title={label + " level"} placeholder={"level"} type="number" value={level} onChange={(event) => setLevel(event.target.value)}></input>
      <ActionButton text={"Set Level"} onClick={() => runAction(() => {
        setStatLevel(snapshot, stat, safeNumber(level, 1));
        return label + " level set";
      }, "Set " + label)}></ActionButton>
      {key === "intelligence" && <span>
        <ActionButton text={"Enable"} onClick={() => runAction(() => {
          if (player.skills.intelligence === 0) player.skills.intelligence = 1;
          player.updateSkillLevels?.();
          return "Intelligence enabled";
        }, "Enable int")}></ActionButton>
        <ActionButton text={"Disable"} style={redStyle} onClick={() => runAction(() => {
          player.exp.intelligence = 0;
          player.skills.intelligence = 0;
          if (player.persistentIntelligenceData) player.persistentIntelligenceData.exp = 0;
          player.updateSkillLevels?.();
          return "Intelligence disabled";
        }, "Disable int")}></ActionButton>
      </span>}
    </Line>
  );
}

function setStatLevel(snapshot, stat, level) {
  const player = snapshot.player;
  const targetLevel = Math.floor(level);
  if (!Number.isFinite(targetLevel) || targetLevel < 1) return;
  const [, key, , nodeMultKey] = stat;
  let mult = getStatLevelMultiplier(snapshot, key, nodeMultKey);
  if (key === "intelligence") {
    player.exp.intelligence = calculateExp(targetLevel, 1);
    if (player.persistentIntelligenceData) player.persistentIntelligenceData.exp = player.exp.intelligence;
    player.skills.intelligence = calculateSkillWithPlayer(player, player.exp.intelligence, 1);
    return;
  } else {
    for (let i = 0; i < 4; i++) {
      player.exp[key] = calculateExp(targetLevel, mult);
      refreshStatLevel(player, key, mult);
      if (player.skills?.[key] === targetLevel) return;
      mult = inferStatLevelMultiplier(player.exp[key], player.skills?.[key], mult);
    }
    player.exp[key] = calculateExp(targetLevel, mult);
    refreshStatLevel(player, key, mult);
  }
}

function getStatLevelMultiplier(snapshot, key, nodeMultKey) {
  const player = snapshot.player;
  const directMult = player.mults?.[key] ?? player.mults?.[key + "_skill"] ?? 1;
  const nodeMult = snapshot.game.currentNodeMults?.[nodeMultKey] ?? 1;
  const inferredMult = inferStatLevelMultiplier(player.exp?.[key], player.skills?.[key], directMult * nodeMult);
  return Number.isFinite(inferredMult) && inferredMult > 0 ? inferredMult : 1;
}

function refreshStatLevel(player, key, mult) {
  const usedNativeRefresh = typeof player.updateSkillLevels === "function";
  player.updateSkillLevels?.();
  if (!player.skills || !player.exp) return;
  if (!usedNativeRefresh) {
    const calculated = calculateSkillWithPlayer(player, player.exp[key], mult);
    if (Number.isFinite(calculated)) player.skills[key] = calculated;
  }
  if (!usedNativeRefresh && key === "defense" && player.hp) {
    const ratio = Math.min((player.hp.current ?? player.hp.max ?? 1) / (player.hp.max ?? 1), 1);
    player.hp.max = Math.floor(10 + player.skills.defense / 10);
    player.hp.current = Math.round(player.hp.max * ratio);
  }
}

function inferStatLevelMultiplier(exp, skill, fallback = 1) {
  if (!Number.isFinite(exp) || !Number.isFinite(skill) || skill < 1) return fallback;
  const base = 32 * Math.log(exp + 534.6) - 200;
  if (!Number.isFinite(base) || base <= 0) return fallback;
  return Math.max(skill / base, 1e-9);
}

function calculateSkillWithPlayer(player, exp, mult = 1) {
  try {
    if (typeof player.calculateSkill === "function") return player.calculateSkill(exp, mult);
  } catch { }
  return calculateSkill(exp, mult);
}

function calculateExp(skill, mult = 1) {
  const floorSkill = Math.floor(skill);
  let value = Math.exp((skill / mult + 200) / 32) - 534.6;
  if (skill === floorSkill && Number.isFinite(skill)) {
    let calcSkill = calculateSkill(value, mult);
    let diff = Math.abs(value * Number.EPSILON);
    let nextValue = value;
    while (calcSkill < skill) {
      nextValue = value + diff;
      diff *= 2;
      calcSkill = calculateSkill(nextValue, mult);
    }
    value = nextValue;
  }
  return Math.max(value, 0);
}

function calculateSkill(exp, mult = 1) {
  return Math.max(Math.floor(mult * (32 * Math.log(exp + 534.6) - 200)), 1);
}

function FactionTools({ snapshot, runAction }) {
  const React = getReactLib();
  const [factionName, setFactionName] = React.useState(snapshot.factions[0] ?? "Illuminati");
  const faction = snapshot.factionObjects.find((item) => item?.name === factionName) ?? snapshot.factionObjects[0];
  const player = snapshot.player;
  if (!faction) return <span>{"Faction internals were not found. Hit Actions -> Rescan Webpack."}</span>;
  return (
    <span>
      <Line label={"Faction:"}>
        <SelectBox value={faction?.name ?? ""} options={snapshot.factions} onChange={setFactionName}></SelectBox>
        <ActionButton text={"Rumor"} onClick={() => runAction(() => {
          player.receiveRumor?.(faction.name);
          return "Rumor received";
        }, "Faction rumor")}></ActionButton>
        <ActionButton text={"Invite"} onClick={() => runAction(() => {
          player.receiveInvite?.(faction.name);
          faction.alreadyInvited = true;
          faction.discovery = "known";
          return "Invite received";
        }, "Faction invite")}></ActionButton>
        <SelectBox value={faction?.discovery ?? "unknown"} options={["unknown", "rumored", "known"]} onChange={(value) => {
          faction.discovery = value;
        }}></SelectBox>
      </Line>
      <Line label={"Reputation: " + formatNumber(faction?.playerReputation ?? 0)}>
        <Adjuster label={"reputation"} placeholder={"amt"} tons={() => runAction(() => {
          faction.playerReputation += 1e12;
          return "Faction reputation added";
        }, "Faction rep")} add={(value) => runAction(() => {
          faction.playerReputation += value;
          return "Faction reputation added";
        }, "Add faction rep")} subtract={(value) => runAction(() => {
          faction.playerReputation -= value;
          return "Faction reputation subtracted";
        }, "Subtract faction rep")} reset={() => runAction(() => {
          faction.playerReputation = 0;
          return "Faction reputation reset";
        }, "Reset faction rep")}></Adjuster>
      </Line>
      <Line label={"Favor: " + formatNumber(faction?.favor ?? 0)}>
        <Adjuster label={"favor"} placeholder={"amt"} tons={() => runAction(() => {
          faction.setFavor?.(MAX_FAVOR);
          return "Faction favor maxed";
        }, "Faction favor")} add={(value) => runAction(() => {
          faction.setFavor?.((faction.favor ?? 0) + value);
          return "Faction favor added";
        }, "Add faction favor")} subtract={(value) => runAction(() => {
          faction.setFavor?.((faction.favor ?? 0) - value);
          return "Faction favor subtracted";
        }, "Subtract faction favor")} reset={() => runAction(() => {
          faction.setFavor?.(0);
          return "Faction favor reset";
        }, "Reset faction favor")}></Adjuster>
      </Line>
      <Line label={"All Factions:"}>
        <ActionButton text={"Forget Discovery"} style={redStyle} onClick={() => runAction(() => {
          snapshot.factionObjects.forEach((item) => item.discovery = "unknown");
          player.factionRumors?.clear?.();
          return "Faction discovery reset";
        }, "Reset discovery")}></ActionButton>
        <ActionButton text={"All Rumors"} onClick={() => runAction(() => {
          snapshot.factionObjects.forEach((item) => player.receiveRumor?.(item.name));
          return "All rumors received";
        }, "All rumors")}></ActionButton>
        <ActionButton text={"All Invites"} onClick={() => runAction(() => {
          snapshot.factionObjects.forEach((item) => {
            player.receiveInvite?.(item.name);
            item.alreadyInvited = true;
            item.discovery = "known";
          });
          return "All invites received";
        }, "All invites")}></ActionButton>
        <ActionButton text={"Tons Rep"} onClick={() => runAction(() => {
          snapshot.factionObjects.forEach((item) => item.playerReputation = 1e12);
          return "All faction rep maxed";
        }, "All rep")}></ActionButton>
        <ActionButton text={"Reset Rep"} style={redStyle} onClick={() => runAction(() => {
          snapshot.factionObjects.forEach((item) => item.playerReputation = 0);
          return "All faction rep reset";
        }, "Reset all rep")}></ActionButton>
        <ActionButton text={"Tons Favor"} onClick={() => runAction(() => {
          snapshot.factionObjects.forEach((item) => item.setFavor?.(MAX_FAVOR));
          return "All faction favor maxed";
        }, "All favor")}></ActionButton>
        <ActionButton text={"Reset Favor"} style={redStyle} onClick={() => runAction(() => {
          snapshot.factionObjects.forEach((item) => item.setFavor?.(0));
          return "All faction favor reset";
        }, "Reset all favor")}></ActionButton>
      </Line>
    </span>
  );
}

function AugmentationTools({ snapshot, runAction }) {
  const React = getReactLib();
  const [augmentation, setAugmentation] = React.useState(snapshot.augmentations[0] ?? "NeuroFlux Governor");
  const [factionName, setFactionName] = React.useState(snapshot.factions[0] ?? "Illuminati");
  const player = snapshot.player;
  const selectedFaction = snapshot.factionObjects.find((item) => item?.name === factionName);
  return (
    <span>
      <Line label={"Augmentation:"}>
        <SelectBox value={augmentation} options={snapshot.augmentations} onChange={setAugmentation} width={360}></SelectBox>
        <ActionButton text={"Queue"} onClick={() => runAction(() => {
          queueAug(player, augmentation);
          return "Augmentation queued";
        }, "Queue aug")}></ActionButton>
        <ActionButton text={"Queue All"} onClick={() => runAction(() => {
          snapshot.augmentations.forEach((name) => queueAug(player, name));
          return "All augmentations queued";
        }, "Queue all augs")}></ActionButton>
      </Line>
      <Line label={"Queued / Installed:"}>
        <ActionButton text={"Quick-install " + (player.queuedAugmentations?.length ?? 0)} onClick={() => runAction(() => {
          installQueuedAugs(snapshot);
          return "Queued augmentations installed";
        }, "Install augs")}></ActionButton>
        <ActionButton text={"Clear queued"} style={redStyle} onClick={() => runAction(() => {
          player.queuedAugmentations = [];
          return "Queued augmentations cleared";
        }, "Clear queued")}></ActionButton>
        <ActionButton text={"Uninstall installed"} style={redStyle} onClick={() => runAction(() => {
          player.augmentations = [];
          player.reapplyAllAugmentations?.();
          player.reapplyAllSourceFiles?.();
          return "Installed augmentations cleared";
        }, "Clear installed")}></ActionButton>
      </Line>
      <Line label={"Faction Augs:"}>
        <SelectBox value={factionName} options={snapshot.factions} onChange={setFactionName} width={250}></SelectBox>
        <ActionButton text={"Queue faction"} onClick={() => runAction(() => {
          (selectedFaction?.augmentations ?? []).forEach((name) => {
            if (name !== "NeuroFlux Governor") queueAug(player, name);
          });
          return "Faction augmentations queued";
        }, "Queue faction augs")}></ActionButton>
        <ActionButton text={"Queue Stanek Gift"} onClick={() => runAction(() => {
          queueAug(player, "Stanek's Gift - Genesis");
          return "Stanek's Gift queued";
        }, "Queue Stanek")}></ActionButton>
      </Line>
    </span>
  );
}

function queueAug(player, name) {
  if (!name) return;
  if (name !== "NeuroFlux Governor" && (player.queuedAugmentations ?? []).some((aug) => aug.name === name)) return;
  if (name !== "NeuroFlux Governor" && (player.augmentations ?? []).some((aug) => aug.name === name)) return;
  try {
    player.queueAugmentation?.(name);
    return;
  } catch { }
  player.queuedAugmentations ??= [];
  const nextLevel = name === "NeuroFlux Governor"
    ? Math.max(1, ...[...player.augmentations, ...player.queuedAugmentations].filter((aug) => aug.name === name).map((aug) => aug.level ?? 1)) + 1
    : 1;
  player.queuedAugmentations.push({ name, level: nextLevel });
}

function installQueuedAugs(snapshot) {
  const player = snapshot.player;
  const apply = snapshot.game.funcs.applyAugmentation;
  for (const aug of player.queuedAugmentations ?? []) {
    if (apply) {
      try {
        apply(aug);
        continue;
      } catch { }
    }
    const existing = player.augmentations?.find((item) => item.name === aug.name);
    if (existing && aug.name === "NeuroFlux Governor") existing.level = aug.level ?? existing.level ?? 1;
    else if (!existing) player.augmentations.push({ name: aug.name, level: aug.level ?? 1 });
  }
  player.queuedAugmentations = [];
  player.reapplyAllAugmentations?.();
  player.reapplyAllSourceFiles?.();
}

function SourceFileTools({ snapshot, runAction }) {
  const React = getReactLib();
  const player = snapshot.player;
  return (
    <span>
      <Line label={"Exploits:"}>
        <ActionButton text={"Clear"} style={redStyle} onClick={() => runAction(() => {
          player.exploits = [];
          return "Exploits cleared";
        }, "Clear exploits")}></ActionButton>
      </Line>
      <Line label={"Set All:"}>
        {[0, 1, 2, 3].map((level) => <ActionButton key={level} text={String(level)} onClick={() => runAction(() => {
          VALID_BITNODES.forEach((bn) => setSourceFile(snapshot, bn, level));
          return "All Source-Files set to " + level;
        }, "Set all SF")}></ActionButton>)}
      </Line>
      {VALID_BITNODES.map((bn) => {
        const currentLevel = sourceFileLevel(player, snapshot.sourceFiles, bn);
        return <Line key={bn} label={"SF-" + bn + " Lvl " + currentLevel}>
          {[0, 1, 2, 3].map((level) => <ActionButton key={level} text={String(level)} style={currentLevel === level ? greenStyle : alwaysOnStyle} onClick={() => runAction(() => {
            setSourceFile(snapshot, bn, level);
            return "SF-" + bn + " set to " + level;
          }, "Set SF-" + bn)}></ActionButton>)}
          {bn === 12 && [1, 10, 100].map((increment) => <ActionButton key={increment} text={"+" + increment} onClick={() => runAction(() => {
            setSourceFile(snapshot, 12, sourceFileLevel(player, snapshot.sourceFiles, 12) + increment);
            return "SF-12 increased";
          }, "Increase SF-12")}></ActionButton>)}
          {bn === 10 && <span>
            <ActionButton text={"-1 sleeve"} onClick={() => runAction(() => {
              const current = player.sleevesFromCovenant ?? 0;
              if (current <= 0) return "Extra sleeves are already at your minimum";
              player.sleevesFromCovenant = current - 1;
              snapshot.game.funcs.recalculateSleeves?.();
              return "Extra sleeve count lowered";
            }, "Remove sleeve")}></ActionButton>
            <ActionButton text={"+1 sleeve"} onClick={() => runAction(() => {
              const current = player.sleevesFromCovenant ?? 0;
              if (current >= 5) return "Extra sleeves are already at maximum";
              player.sleevesFromCovenant = current + 1;
              snapshot.game.funcs.recalculateSleeves?.();
              return "Extra sleeve count raised";
            }, "Add sleeve")}></ActionButton>
            <span style={miniMetaStyle}>{" Extra: " + (player.sleevesFromCovenant ?? 0)}</span>
          </span>}
        </Line>;
      })}
    </span>
  );
}

function setSourceFile(snapshot, n, level) {
  const player = snapshot.player;
  player.sourceFiles ??= new Map();
  player.bitNodeOptions ??= {};
  player.bitNodeOptions.sourceFileOverrides ??= new Map();
  if (n === 9 && Array.isArray(player.hacknetNodes)) {
    player.hacknetNodes = level <= 0
      ? player.hacknetNodes.filter((node) => typeof node !== "string")
      : player.hacknetNodes.filter((node) => typeof node === "string");
  }
  if (n === 15 && level > 0) {
    if (snapshot.game.funcs.getDarkscapeNavigator) snapshot.game.funcs.getDarkscapeNavigator();
    else pushProgram(snapshot.home, "DarkscapeNavigator.exe");
  }
  if (level <= 0) {
    player.sourceFiles.delete?.(n);
    player.bitNodeOptions.sourceFileOverrides.delete?.(n);
  } else {
    player.sourceFiles.set?.(n, level);
    player.bitNodeOptions.sourceFileOverrides.set?.(n, level);
  }
  if (n === 10) snapshot.game.funcs.recalculateSleeves?.();
}

function ProgramTools({ snapshot, runAction }) {
  const React = getReactLib();
  const [program, setProgram] = React.useState(snapshot.programs[0] ?? "BruteSSH.exe");
  const home = snapshot.home;
  return (
    <span>
      <Line label={"Program:"}>
        <SelectBox value={program} options={snapshot.programs} onChange={setProgram} width={250}></SelectBox>
        <ActionButton text={"Add One"} onClick={() => runAction(() => {
          home.pushProgram?.(program);
          if (!home.pushProgram && !home.programs.includes(program)) home.programs.push(program);
          return program + " added";
        }, "Add program")}></ActionButton>
        <ActionButton text={"Add All"} onClick={() => runAction(() => {
          snapshot.programs.forEach((name) => pushProgram(home, name));
          return "All programs added";
        }, "Add all programs")}></ActionButton>
      </Line>
    </span>
  );
}

function ServerTools({ snapshot, runAction }) {
  const React = getReactLib();
  const [serverName, setServerName] = React.useState("home");
  const getSvr = snapshot.game.GetServer;
  const selectedServer = getSvr?.(serverName);
  const allHackable = snapshot.servers.filter((server) => isMutableServer(server));
  return (
    <span>
      <Line label={"Server:"}>
        <SelectBox value={serverName} options={snapshot.serverNames} onChange={setServerName} width={250}></SelectBox>
        <span style={miniMetaStyle}>{selectedServer ? " " + formatMoney(selectedServer.moneyAvailable ?? 0) + " / " + formatMoney(selectedServer.moneyMax ?? 0) : ""}</span>
      </Line>
      <Line label={"Root:"}>
        <ActionButton text={"Root one"} onClick={() => runAction(() => {
          rootServer(selectedServer);
          return serverName + " rooted";
        }, "Root server")}></ActionButton>
        <ActionButton text={"Root all"} onClick={() => runAction(() => {
          allHackable.forEach(rootServer);
          return "All servers rooted";
        }, "Root all")}></ActionButton>
      </Line>
      <Line label={"Backdoor:"}>
        <ActionButton text={"Backdoor one"} onClick={() => runAction(() => {
          selectedServer.backdoorInstalled = true;
          return serverName + " backdoored";
        }, "Backdoor server")}></ActionButton>
        <ActionButton text={"Backdoor all"} onClick={() => runAction(() => {
          allHackable.filter((server) => server.hostname !== "w0r1d_d43m0n").forEach((server) => server.backdoorInstalled = true);
          return "All eligible servers backdoored";
        }, "Backdoor all")}></ActionButton>
      </Line>
      <Line label={"Security:"}>
        <ActionButton text={"Min one"} onClick={() => runAction(() => {
          selectedServer.hackDifficulty = selectedServer.minDifficulty;
          return serverName + " security minimized";
        }, "Min security")}></ActionButton>
        <ActionButton text={"Min all"} onClick={() => runAction(() => {
          allHackable.forEach((server) => server.hackDifficulty = server.minDifficulty);
          return "All security minimized";
        }, "Min all security")}></ActionButton>
      </Line>
      <Line label={"Money:"}>
        <ActionButton text={"Min one"} onClick={() => runAction(() => {
          selectedServer.moneyAvailable = 0;
          return serverName + " money cleared";
        }, "Min money")}></ActionButton>
        <ActionButton text={"Min all"} onClick={() => runAction(() => {
          allHackable.forEach((server) => server.moneyAvailable = 0);
          return "All server money cleared";
        }, "Min all money")}></ActionButton>
        <ActionButton text={"Max one"} onClick={() => runAction(() => {
          selectedServer.moneyAvailable = selectedServer.moneyMax;
          return serverName + " money maxed";
        }, "Max money")}></ActionButton>
        <ActionButton text={"Max all"} onClick={() => runAction(() => {
          allHackable.forEach((server) => server.moneyAvailable = server.moneyMax);
          return "All server money maxed";
        }, "Max all money")}></ActionButton>
      </Line>
    </span>
  );
}

function isMutableServer(server) {
  return server && typeof server === "object" && "hostname" in server && "hasAdminRights" in server;
}

function rootServer(server) {
  if (!server) return;
  server.hasAdminRights = true;
  server.sshPortOpen = true;
  server.ftpPortOpen = true;
  server.smtpPortOpen = true;
  server.httpPortOpen = true;
  server.sqlPortOpen = true;
  server.openPortCount = 5;
}

function CompanyTools({ snapshot, runAction }) {
  const React = getReactLib();
  const [companyName, setCompanyName] = React.useState(snapshot.companies[0] ?? "ECorp");
  const company = snapshot.companyObjects.find((item) => item?.name === companyName) ?? snapshot.companyObjects[0];
  const relatedFaction = company?.relatedFaction;
  const relatedFactionObject = snapshot.factionObjects.find((item) => item?.name === relatedFaction);
  const player = snapshot.player;
  if (!company) return <span>{"Company internals were not found. Hit Actions -> Rescan Webpack."}</span>;
  return (
    <span>
      <Line label={"Company:"}>
        <SelectBox value={company?.name ?? ""} options={snapshot.companies} onChange={setCompanyName} width={250}></SelectBox>
      </Line>
      {relatedFaction ? <Line label={"Related Faction:"}>
        <ActionButton text={"Invite " + relatedFaction} onClick={() => runAction(() => {
          player.receiveInvite?.(relatedFaction);
          if (relatedFactionObject) {
            relatedFactionObject.alreadyInvited = true;
            relatedFactionObject.discovery = "known";
          }
          return relatedFaction + " invite received";
        }, "Company faction invite")}></ActionButton>
      </Line> : null}
      <Line label={"Reputation: " + formatNumber(company?.playerReputation ?? 0)}>
        <Adjuster label={"reputation"} placeholder={"amt"} tons={() => runAction(() => {
          company.playerReputation = 1e12;
          return "Company reputation maxed";
        }, "Company rep")} add={(value) => runAction(() => {
          company.playerReputation += value;
          return "Company reputation added";
        }, "Add company rep")} subtract={(value) => runAction(() => {
          company.playerReputation -= value;
          return "Company reputation subtracted";
        }, "Subtract company rep")} reset={() => runAction(() => {
          company.playerReputation = 0;
          return "Company reputation reset";
        }, "Reset company rep")}></Adjuster>
      </Line>
      <Line label={"Favor: " + formatNumber(company?.favor ?? 0)}>
        <Adjuster label={"favor"} placeholder={"amt"} tons={() => runAction(() => {
          company.setFavor?.(MAX_FAVOR);
          return "Company favor maxed";
        }, "Company favor")} add={(value) => runAction(() => {
          company.setFavor?.((company.favor ?? 0) + value);
          return "Company favor added";
        }, "Add company favor")} subtract={(value) => runAction(() => {
          company.setFavor?.((company.favor ?? 0) - value);
          return "Company favor subtracted";
        }, "Subtract company favor")} reset={() => runAction(() => {
          company.setFavor?.(0);
          return "Company favor reset";
        }, "Reset company favor")}></Adjuster>
      </Line>
      <Line label={"All Companies:"}>
        <ActionButton text={"Tons Rep"} onClick={() => runAction(() => {
          snapshot.companyObjects.forEach((item) => item.playerReputation = 1e12);
          return "All company rep maxed";
        }, "All company rep")}></ActionButton>
        <ActionButton text={"Reset Rep"} style={redStyle} onClick={() => runAction(() => {
          snapshot.companyObjects.forEach((item) => item.playerReputation = 0);
          return "All company rep reset";
        }, "Reset company rep")}></ActionButton>
        <ActionButton text={"Tons Favor"} onClick={() => runAction(() => {
          snapshot.companyObjects.forEach((item) => item.setFavor?.(MAX_FAVOR));
          return "All company favor maxed";
        }, "All company favor")}></ActionButton>
        <ActionButton text={"Reset Favor"} style={redStyle} onClick={() => runAction(() => {
          snapshot.companyObjects.forEach((item) => item.setFavor?.(0));
          return "All company favor reset";
        }, "Reset company favor")}></ActionButton>
      </Line>
    </span>
  );
}

function BladeburnerTools({ snapshot, runAction }) {
  const React = getReactLib();
  const [skill, setSkill] = React.useState(snapshot.bladeSkills[0] ?? DEFAULT_BLADE_SKILLS[0]);
  const [contract, setContract] = React.useState("Tracking");
  const [operation, setOperation] = React.useState("Investigation");
  const player = snapshot.player;
  const bb = player.bladeburner;
  if (!bb) return <span><ActionButton text={"Join Bladeburner"} onClick={() => runAction(() => {
    player.startBladeburner?.();
    return "Joined Bladeburner";
  }, "Join Bladeburner")}></ActionButton></span>;
  const contracts = objectValues(bb.contracts).map((item) => item.name);
  const operations = objectValues(bb.operations).map((item) => item.name);
  const contractName = contracts.includes(contract) ? contract : (contracts[0] ?? "Tracking");
  const operationName = operations.includes(operation) ? operation : (operations[0] ?? "Investigation");
  return (
    <span>
      <Line label={"Rank: " + formatNumber(bb.rank ?? 0)}>
        <Adjuster label={"rank"} placeholder={"amt"} tons={() => runAction(() => {
          changeBladeburnerRank(bb, player, BIG);
          return "Bladeburner rank added";
        }, "BB rank")} add={(value) => runAction(() => {
          changeBladeburnerRank(bb, player, value);
          return "Bladeburner rank added";
        }, "Add BB rank")} subtract={(value) => runAction(() => {
          changeBladeburnerRank(bb, player, -value);
          return "Bladeburner rank subtracted";
        }, "Subtract BB rank")} reset={() => runAction(() => {
          bb.rank = 0;
          bb.maxRank = 0;
          return "Bladeburner rank reset";
        }, "Reset BB rank")}></Adjuster>
      </Line>
      <Line label={"SP: " + formatNumber(bb.skillPoints ?? 0)}>
        <Adjuster label={"skill points"} placeholder={"amt"} tons={() => runAction(() => {
          bb.skillPoints = BIG;
          bb.totalSkillPoints = Math.max(bb.totalSkillPoints ?? 0, BIG);
          return "Bladeburner SP maxed";
        }, "BB SP")} add={(value) => runAction(() => {
          bb.skillPoints += value;
          bb.totalSkillPoints = (bb.totalSkillPoints ?? 0) + value;
          return "Bladeburner SP added";
        }, "Add BB SP")} subtract={(value) => runAction(() => {
          bb.skillPoints -= value;
          return "Bladeburner SP subtracted";
        }, "Subtract BB SP")} reset={() => runAction(() => {
          bb.skillPoints = 0;
          bb.totalSkillPoints = 0;
          return "Bladeburner SP reset";
        }, "Reset BB SP")}></Adjuster>
      </Line>
      <Line label={"Cycles: " + formatNumber(bb.storedCycles ?? 0)}>
        <Adjuster label={"cycles"} placeholder={"amt"} tons={() => runAction(() => {
          bb.storedCycles += BIG;
          return "Bladeburner cycles added";
        }, "BB cycles")} add={(value) => runAction(() => {
          bb.storedCycles += value;
          return "Bladeburner cycles added";
        }, "Add BB cycles")} subtract={(value) => runAction(() => {
          bb.storedCycles -= value;
          return "Bladeburner cycles subtracted";
        }, "Subtract BB cycles")} reset={() => runAction(() => {
          bb.storedCycles = 0;
          return "Bladeburner cycles reset";
        }, "Reset BB cycles")}></Adjuster>
      </Line>
      <Line label={"Chaos:"}>
        <Adjuster label={"all cities"} placeholder={"amt"} tons={() => runAction(() => {
          objectValues(bb.cities).forEach((city) => changeCityChaos(city, BIG));
          return "City chaos added";
        }, "BB chaos")} add={(value) => runAction(() => {
          objectValues(bb.cities).forEach((city) => changeCityChaos(city, value));
          return "City chaos added";
        }, "Add chaos")} subtract={(value) => runAction(() => {
          objectValues(bb.cities).forEach((city) => changeCityChaos(city, -value));
          return "City chaos subtracted";
        }, "Subtract chaos")} reset={() => runAction(() => {
          objectValues(bb.cities).forEach((city) => city.chaos = 0);
          return "City chaos wiped";
        }, "Wipe chaos")}></Adjuster>
        <ActionButton text={"Wipe Active City"} onClick={() => runAction(() => {
          if (bb.cities?.[bb.city]) bb.cities[bb.city].chaos = 0;
          return "Active city chaos wiped";
        }, "Wipe active chaos")}></ActionButton>
      </Line>
      <Line label={"Skill:"}>
        <SelectBox value={skill} options={snapshot.bladeSkills} onChange={setSkill} width={250}></SelectBox>
        <Adjuster label={"level"} placeholder={"amt"} tons={() => runAction(() => {
          //bb.setSkillLevel?.(skill, (bb.getSkillLevel?.(skill) ?? 0) + BIG);
          bb.setSkillLevel?.(skill, (bb["getSkillLevel"]?.(skill) ?? 0) + BIG);
          bb.updateSkillMultipliers?.();
          return "Bladeburner skill raised";
        }, "BB skill")} add={(value) => runAction(() => {
          bb.setSkillLevel?.(skill, (bb["getSkillLevel"]?.(skill) ?? 0) + value);
          bb.updateSkillMultipliers?.();
          return "Bladeburner skill raised";
        }, "Add BB skill")} subtract={(value) => runAction(() => {
          bb.setSkillLevel?.(skill, (bb["getSkillLevel"]?.(skill) ?? 0) - value);
          bb.updateSkillMultipliers?.();
          return "Bladeburner skill lowered";
        }, "Subtract BB skill")} reset={() => runAction(() => {
          bb.setSkillLevel?.(skill, 0);
          bb.updateSkillMultipliers?.();
          return "Bladeburner skill reset";
        }, "Reset BB skill")}></Adjuster>
      </Line>
      <BladeActionEditor title={"Contract"} action={bb.contracts?.[contractName] ?? objectValues(bb.contracts).find((item) => item.name === contractName)} options={contracts} selected={contractName} setSelected={setContract} runAction={runAction}></BladeActionEditor>
      <BladeActionEditor title={"Operation"} action={bb.operations?.[operationName] ?? objectValues(bb.operations).find((item) => item.name === operationName)} options={operations} selected={operationName} setSelected={setOperation} runAction={runAction}></BladeActionEditor>
    </span>
  );
}

function BladeActionEditor({ title, action, options, selected, setSelected, runAction }) {
  const React = getReactLib();
  const [field, setField] = React.useState("Count");
  const fieldKey = field.toLowerCase();
  return (
    <Line label={title + ":"}>
      <SelectBox value={selected} options={options} onChange={setSelected} width={230}></SelectBox>
      <SelectBox value={field} options={["Count", "Level", "Successes"]} onChange={setField} width={120}></SelectBox>
      <Adjuster label={fieldKey} placeholder={"amt"} tons={() => runAction(() => {
        changeBladeActionField(action, fieldKey, BIG);
        return title + " " + fieldKey + " raised";
      }, title + " " + fieldKey)} add={(value) => runAction(() => {
        changeBladeActionField(action, fieldKey, value);
        return title + " " + fieldKey + " raised";
      }, "Add " + title + " " + fieldKey)} subtract={(value) => runAction(() => {
        changeBladeActionField(action, fieldKey, -value);
        return title + " " + fieldKey + " lowered";
      }, "Subtract " + title + " " + fieldKey)} reset={() => runAction(() => {
        resetBladeActionField(action, fieldKey);
        return title + " " + fieldKey + " reset";
      }, "Reset " + title + " " + fieldKey)}></Adjuster>
    </Line>
  );
}

function changeBladeActionField(action, fieldKey, value) {
  if (!action) return;
  const defaultValue = fieldKey === "level" ? 1 : 0;
  action[fieldKey] = (action[fieldKey] ?? defaultValue) + value;
  if (fieldKey === "level") action.maxLevel = action.level;
}

function resetBladeActionField(action, fieldKey) {
  if (!action) return;
  action[fieldKey] = fieldKey === "level" ? 1 : 0;
  if (fieldKey === "level") action.maxLevel = 1;
}

function changeBladeburnerRank(bb, player, value) {
  if (bb.changeRank) bb.changeRank(player, value);
  else bb.rank = (bb.rank ?? 0) + value;
}

function changeCityChaos(city, value) {
  if (city.changeChaosByCount) city.changeChaosByCount(value);
  else city.chaos = (city.chaos ?? 0) + value;
}

function GangTools({ snapshot, runAction }) {
  const React = getReactLib();
  const gang = snapshot.player.gang;
  if (!gang) return <span>{"Create a gang from the General row first."}</span>;
  return (
    <Line label={"Cycles: " + formatNumber(gang.storedCycles ?? 0)}>
      <Adjuster label={"cycles"} placeholder={"amt"} tons={() => runAction(() => {
        gang.storedCycles = BIG;
        return "Gang cycles maxed";
      }, "Gang cycles")} add={(value) => runAction(() => {
        gang.storedCycles += value;
        return "Gang cycles added";
      }, "Add gang cycles")} subtract={(value) => runAction(() => {
        gang.storedCycles -= value;
        return "Gang cycles subtracted";
      }, "Subtract gang cycles")} reset={() => runAction(() => {
        gang.storedCycles = 0;
        return "Gang cycles reset";
      }, "Reset gang cycles")}></Adjuster>
    </Line>
  );
}

function CorporationTools({ snapshot, runAction }) {
  const React = getReactLib();
  const corp = snapshot.player.corporation;
  if (!corp) return <span>{"Create a corporation from the General row first."}</span>;
  return (
    <span>
      <Line label={"Funds: " + formatMoney(corp.funds ?? 0)}>
        <Adjuster label={"funds"} placeholder={"amt"} tons={() => runAction(() => {
          gainCorpFunds(corp, BIG);
          return "Corporation funds added";
        }, "Corp funds")} add={(value) => runAction(() => {
          gainCorpFunds(corp, value);
          return "Corporation funds added";
        }, "Add corp funds")} subtract={(value) => runAction(() => {
          loseCorpFunds(corp, value);
          return "Corporation funds subtracted";
        }, "Subtract corp funds")} reset={() => runAction(() => {
          loseCorpFunds(corp, corp.funds ?? 0);
          return "Corporation funds reset";
        }, "Reset corp funds")}></Adjuster>
      </Line>
      <Line label={"Cycles: " + formatNumber(corp.storedCycles ?? 0)}>
        <Adjuster label={"cycles"} placeholder={"amt"} tons={() => runAction(() => {
          corp.storedCycles = BIG;
          return "Corporation cycles maxed";
        }, "Corp cycles")} add={(value) => runAction(() => {
          corp.storedCycles += value;
          return "Corporation cycles added";
        }, "Add corp cycles")} subtract={(value) => runAction(() => {
          corp.storedCycles -= value;
          return "Corporation cycles subtracted";
        }, "Subtract corp cycles")} reset={() => runAction(() => {
          corp.storedCycles = 0;
          return "Corporation cycles reset";
        }, "Reset corp cycles")}></Adjuster>
      </Line>
      <Line label={"Operations:"}>
        <ActionButton text={"Finish products"} onClick={() => runAction(() => {
          corp.divisions?.forEach?.((division) => division.products?.forEach?.((product) => product.developmentProgress = 99.9));
          return "Products nearly finished";
        }, "Finish products")}></ActionButton>
        <ActionButton text={"Tons research"} onClick={() => runAction(() => {
          corp.divisions?.forEach?.((division) => division.researchPoints += 1e10);
          return "Research added";
        }, "Corp research")}></ActionButton>
        <ActionButton text={"Reset stock cooldowns"} onClick={() => runAction(() => {
          corp.shareSaleCooldown = 0;
          corp.issueNewSharesCooldown = 0;
          return "Stock cooldowns reset";
        }, "Corp cooldowns")}></ActionButton>
      </Line>
    </span>
  );
}

function gainCorpFunds(corp, value) {
  if (corp.gainFunds) corp.gainFunds(value, "force majeure");
  else corp.funds = (corp.funds ?? 0) + value;
}

function loseCorpFunds(corp, value) {
  if (corp.loseFunds) corp.loseFunds(value, "force majeure");
  else corp.funds = (corp.funds ?? 0) - value;
}

function CodingContractTools({ snapshot, runAction }) {
  const React = getReactLib();
  const [contractType, setContractType] = React.useState(snapshot.contractTypes[0] ?? DEFAULT_CONTRACT_TYPES[0]);
  const [contractCount, setContractCount] = React.useState("1");
  return (
    <Line label={"Contracts:"}>
      <SelectBox value={contractType} options={snapshot.contractTypes} onChange={setContractType} width={360}></SelectBox>
      <span style={fieldGroupStyle}><span style={fieldLabelStyle}>{"Amt"}</span><input style={tinyInputStyle} title={"number of contracts"} placeholder={"1"} value={contractCount} type="number" onChange={(event) => setContractCount(event.target.value)}></input></span>
      <ActionButton text={"Generate specified"} onClick={() => runAction(() => {
        const count = Math.max(1, Math.floor(safeNumber(contractCount, 1)));
        const created = [];
        for (let i = 0; i < count; i++) {
          const name = createDummyContractOnHome(snapshot, contractType);
          if (name) created.push(name);
        }
        return created.length ? "Generated " + created.length + " contract(s)" : "Contract generation failed";
      }, "Generate contract")}></ActionButton>
      <ActionButton text={"Random on home"} onClick={() => runAction(() => {
        const count = Math.max(1, Math.floor(safeNumber(contractCount, 1)));
        const created = [];
        for (let i = 0; i < count; i++) {
          const type = snapshot.contractTypes[Math.floor(Math.random() * snapshot.contractTypes.length)];
          const name = createDummyContractOnHome(snapshot, type);
          if (name) created.push(name);
        }
        return created.length ? "Generated " + created.length + " random contract(s)" : "Contract generation failed";
      }, "Generate random contract")}></ActionButton>
    </Line>
  );
}

function createDummyContractOnHome(snapshot, contractType) {
  const game = globalThis.__devMenuTestBridge ?? snapshot.game;
  const generator = game?.funcs?.generateDummyContract;
  if (!generator) {
    exposeInternalGameObjects(true);
  }
  const generateDummyContract = (globalThis.__devMenuTestBridge?.funcs ?? game?.funcs)?.generateDummyContract;
  const home = globalThis.__devMenuTestBridge?.Player?.getHomeComputer?.() ?? snapshot.home;
  if (!generateDummyContract || !home) return null;
  return generateDummyContract(contractType, home);
}

function StockTools({ snapshot, runAction, setStatus }) {
  const React = getReactLib();
  const [symbol, setSymbol] = React.useState("All");
  const [price, setPrice] = React.useState("1000000");
  const stocks = getStocks(snapshot.game);
  const stockOptions = ["All", ...uniqueSorted([...snapshot.stockSymbols, ...stocks.map((stock) => stock.symbol)])];
  const selectedSymbol = stockOptions.includes(symbol) ? symbol : "All";
  const matchingStocks = () => {
    if (!selectedSymbol || selectedSymbol === "All") return stocks;
    return stocks.filter((stock) => stock.symbol === selectedSymbol);
  };
  return (
    <span>
      <Line label={"Stock:"}>
        <SelectBox value={selectedSymbol} options={stockOptions} onChange={setSymbol}></SelectBox>
      </Line>
      <Line label={"Price:"}>
        <input style={inputStyle} value={price} onChange={(event) => setPrice(event.target.value)}></input>
        <ActionButton text={"Set"} onClick={() => runAction(() => {
          matchingStocks().forEach((stock) => stock.price = safeNumber(price));
          return "Stock price set for " + matchingStocks().length + " stock(s)";
        }, "Set stock price")}></ActionButton>
        <ActionButton text={"View caps"} onClick={() => runAction(() => {
          const text = matchingStocks().map((stock) => stock.symbol + ": " + formatMoney(stock.cap)).join(" | ");
          setStatus(text || "No matching stocks");
          return "Stock caps shown in toolbar";
        }, "View stock caps")}></ActionButton>
      </Line>
    </span>
  );
}

function SleeveTools({ snapshot, runAction }) {
  const React = getReactLib();
  const sleeves = snapshot.player.sleeves ?? [];
  const [sleeveTarget, setSleeveTarget] = React.useState("All");
  const [shockValue, setShockValue] = React.useState("");
  const [syncValue, setSyncValue] = React.useState("");
  const [cycleValue, setCycleValue] = React.useState("");
  const [sleeveAug, setSleeveAug] = React.useState("All");
  const sleeveOptions = ["All", ...sleeves.map((_, index) => "Sleeve " + index)];
  const selectedTarget = sleeveOptions.includes(sleeveTarget) ? sleeveTarget : "All";
  const targetSleeves = () => selectedTarget === "All" ? sleeves : [sleeves[Number(selectedTarget.replace("Sleeve ", ""))]].filter(Boolean);
  const targets = targetSleeves();
  const augOptions = ["All", ...getSleeveAugmentationNames(snapshot, targets)];
  const selectedAug = augOptions.includes(sleeveAug) ? sleeveAug : "All";
  const targetLabel = selectedTarget === "All" ? "all sleeves" : selectedTarget;
  if (!sleeves.length) return <span>{"No sleeves are currently available."}</span>;
  return (
    <span>
      <Line label={"Sleeve:"}>
        <SelectBox value={selectedTarget} options={sleeveOptions} onChange={(value) => {
          setSleeveTarget(value);
          setSleeveAug("All");
        }}></SelectBox>
        <span style={miniMetaStyle}>{targetLabel}</span>
      </Line>
      <Line label={"Shock:"}>
        <input style={tinyInputStyle} title={"shock"} placeholder={"0-100"} value={shockValue} type="number" onChange={(event) => setShockValue(event.target.value)}></input>
        <ActionButton text={"Set"} onClick={() => runAction(() => {
          setSleeveField(targetSleeves(), "shock", clampNumber(safeNumber(shockValue), 0, 100));
          return "Sleeve shock set for " + targetLabel;
        }, "Set sleeve shock")}></ActionButton>
        <ActionButton text={"Max"} onClick={() => runAction(() => {
          setSleeveField(targetSleeves(), "shock", 100);
          return "Sleeve shock maxed";
        }, "Sleeve shock")}></ActionButton>
        <ActionButton text={"Clear"} onClick={() => runAction(() => {
          setSleeveField(targetSleeves(), "shock", 0);
          return "Sleeve shock cleared";
        }, "Clear sleeve shock")}></ActionButton>
      </Line>
      <Line label={"Sync:"}>
        <input style={tinyInputStyle} title={"sync"} placeholder={"0-100"} value={syncValue} type="number" onChange={(event) => setSyncValue(event.target.value)}></input>
        <ActionButton text={"Set"} onClick={() => runAction(() => {
          setSleeveField(targetSleeves(), "sync", clampNumber(safeNumber(syncValue), 0, 100));
          return "Sleeve sync set for " + targetLabel;
        }, "Set sleeve sync")}></ActionButton>
        <ActionButton text={"Max"} onClick={() => runAction(() => {
          setSleeveField(targetSleeves(), "sync", 100);
          return "Sleeve sync maxed";
        }, "Sleeve sync")}></ActionButton>
        <ActionButton text={"Clear"} onClick={() => runAction(() => {
          setSleeveField(targetSleeves(), "sync", 0);
          return "Sleeve sync cleared";
        }, "Clear sleeve sync")}></ActionButton>
      </Line>
      <Line label={"Stored Cycles:"}>
        <input style={smallInputStyle} title={"stored cycles"} placeholder={"cycles"} value={cycleValue} type="number" onChange={(event) => setCycleValue(event.target.value)}></input>
        <ActionButton text={"Set"} onClick={() => runAction(() => {
          setSleeveField(targetSleeves(), "storedCycles", Math.max(0, safeNumber(cycleValue)));
          return "Sleeve cycles set for " + targetLabel;
        }, "Set sleeve cycles")}></ActionButton>
        <ActionButton text={"Add"} onClick={() => runAction(() => {
          changeSleeveField(targetSleeves(), "storedCycles", safeNumber(cycleValue));
          return "Sleeve cycles added for " + targetLabel;
        }, "Add sleeve cycles")}></ActionButton>
        <ActionButton text={"10m"} onClick={() => runAction(() => {
          setSleeveField(targetSleeves(), "storedCycles", 10000000);
          return "Sleeve cycles set for " + targetLabel;
        }, "Sleeve cycles")}></ActionButton>
        <ActionButton text={"Clear"} style={redStyle} onClick={() => runAction(() => {
          setSleeveField(targetSleeves(), "storedCycles", 0);
          return "Sleeve cycles reset";
        }, "Reset sleeve cycles")}></ActionButton>
      </Line>
      <Line label={"Augments:"}>
        <SelectBox value={selectedAug} options={augOptions} onChange={setSleeveAug}></SelectBox>
        <ActionButton text={"Install"} onClick={() => runAction(() => installSleeveAugmentations(snapshot, targetSleeves(), selectedAug), "Install sleeve augments")}></ActionButton>
        <span style={miniMetaStyle}>{countSleeveAugmentations(snapshot, targets, selectedAug) + " ready"}</span>
      </Line>
    </span>
  );
}

function setSleeveField(sleeves, field, value) {
  sleeves.forEach((sleeve) => sleeve[field] = value);
}

function changeSleeveField(sleeves, field, value) {
  sleeves.forEach((sleeve) => sleeve[field] = Math.max(0, safeNumber(sleeve[field]) + value));
}

function clampNumber(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

const SLEEVE_AUGMENT_MULTS = [
  "hacking",
  "strength",
  "defense",
  "dexterity",
  "agility",
  "charisma",
  "hacking_exp",
  "strength_exp",
  "defense_exp",
  "dexterity_exp",
  "agility_exp",
  "charisma_exp",
  "company_rep",
  "faction_rep",
  "crime_money",
  "crime_success",
  "work_money",
];

function getSleeveAugmentationObjects(snapshot, sleeves) {
  const byName = new Map();
  const allAugs = getAugmentationObjects(snapshot.game);
  if (allAugs.length) {
    sleeves.forEach((sleeve) => {
      for (const aug of allAugs) {
        if (isSleeveAugReady(sleeve, aug) && !byName.has(aug.name)) byName.set(aug.name, aug);
      }
    });
  } else {
    sleeves.forEach((sleeve) => {
      try {
        for (const aug of sleeve.findPurchasableAugs?.() ?? []) {
          if (aug?.name && !byName.has(aug.name)) byName.set(aug.name, aug);
        }
      } catch { }
    });
  }
  return [...byName.values()].sort((a, b) => String(a.name).localeCompare(String(b.name)));
}

function getSleeveAugmentationNames(snapshot, sleeves) {
  return getSleeveAugmentationObjects(snapshot, sleeves).map((aug) => aug.name);
}

function countSleeveAugmentations(snapshot, sleeves, augName) {
  let count = 0;
  const allAugs = getAugmentationObjects(snapshot.game);
  if (allAugs.length) {
    sleeves.forEach((sleeve) => {
      count += allAugs.filter((aug) => isSleeveAugReady(sleeve, aug) && (augName === "All" || aug.name === augName)).length;
    });
  } else {
    sleeves.forEach((sleeve) => {
      try {
        const available = sleeve.findPurchasableAugs?.() ?? [];
        count += augName === "All" ? available.length : available.filter((aug) => aug?.name === augName).length;
      } catch { }
    });
  }
  return count;
}

function installSleeveAugmentations(snapshot, sleeves, augName) {
  const allAugs = getAugmentationObjects(snapshot.game);
  if (!allAugs.length) return installSleeveAugmentationsFallback(sleeves, augName);
  let installed = 0;
  sleeves.forEach((sleeve) => {
    if (augName === "All") {
      let madeProgress = true;
      while (madeProgress) {
        madeProgress = false;
        for (const aug of allAugs) {
          if (!isSleeveAugReady(sleeve, aug)) continue;
          if (forceInstallSleeveAugmentation(sleeve, aug)) {
            installed++;
            madeProgress = true;
          }
        }
      }
      return;
    }
    const aug = allAugs.find((item) => item.name === augName);
    if (aug && isSleeveAugReady(sleeve, aug) && forceInstallSleeveAugmentation(sleeve, aug)) installed++;
  });
  return installed ? "Installed " + installed + " sleeve augmentation(s)" : "No sleeve augmentations were installed";
}

function installSleeveAugmentationsFallback(sleeves, augName) {
  let installed = 0;
  sleeves.forEach((sleeve) => {
    let available = [];
    try {
      available = sleeve.findPurchasableAugs?.() ?? [];
    } catch { }
    const selected = augName === "All" ? available : available.filter((aug) => aug?.name === augName);
    selected.forEach((aug) => {
      if (forceInstallSleeveAugmentation(sleeve, aug)) installed++;
    });
  });
  return installed ? "Installed " + installed + " sleeve augmentation(s)" : "No sleeve augmentations were installed";
}

function forceInstallSleeveAugmentation(sleeve, aug) {
  try {
    if (!aug || !isSleeveAugAllowed(aug) || sleeveHasAugmentation(sleeve, aug.name) || !hasSleeveAugPrereqs(sleeve, aug)) return false;
    if (typeof sleeve.installAugmentation === "function") {
      sleeve.installAugmentation(aug);
      return true;
    }
  } catch { }
  return false;
}

function isSleeveAugReady(sleeve, aug) {
  return isSleeveAugAllowed(aug) && !sleeveHasAugmentation(sleeve, aug.name) && hasSleeveAugPrereqs(sleeve, aug);
}

function isSleeveAugAllowed(aug) {
  if (!isAugmentationObject(aug)) return false;
  if (String(aug.name).includes("Z.O.")) return true;
  if (aug.isSpecial) return false;
  return SLEEVE_AUGMENT_MULTS.some((mult) => safeNumber(aug.mults?.[mult], 1) !== 1);
}

function hasSleeveAugPrereqs(sleeve, aug) {
  const owned = new Set((sleeve?.augmentations ?? []).map((item) => item?.name));
  return (aug.prereqs ?? []).every((name) => owned.has(name));
}

function sleeveHasAugmentation(sleeve, augName) {
  return (sleeve?.augmentations ?? []).some((item) => item?.name === augName);
}

function StanekTools({ snapshot, runAction }) {
  const React = getReactLib();
  const gift = snapshot.game.staneksGift;
  if (!gift) return <span>{"Stanek internals were not found. If you own the Gift, hit Actions -> Rescan Webpack."}</span>;
  return (
    <span>
      <Line label={"Cycles: " + formatNumber(gift.storedCycles ?? 0)}>
        <Adjuster label={"cycles"} placeholder={"amt"} tons={() => runAction(() => {
          gift.storedCycles = 1e6;
          return "Stanek cycles set";
        }, "Stanek cycles")} add={(value) => runAction(() => {
          gift.storedCycles += value;
          return "Stanek cycles added";
        }, "Add Stanek cycles")} subtract={(value) => runAction(() => {
          gift.storedCycles -= value;
          return "Stanek cycles subtracted";
        }, "Subtract Stanek cycles")} reset={() => runAction(() => {
          gift.storedCycles = 0;
          return "Stanek cycles reset";
        }, "Reset Stanek cycles")}></Adjuster>
      </Line>
      <Line label={"Charge:"}>
        <Adjuster label={"all charge"} placeholder={"amt"} tons={() => runAction(() => {
          gift.fragments.forEach((fragment) => {
            fragment.highestCharge = 1e21;
            fragment.numCharge = 1e21;
          });
          snapshot.player.applyEntropy?.(snapshot.player.entropy);
          return "Stanek charge maxed";
        }, "Stanek charge")} add={(value) => runAction(() => {
          gift.fragments.forEach((fragment) => fragment.highestCharge += value);
          snapshot.player.applyEntropy?.(snapshot.player.entropy);
          return "Stanek charge added";
        }, "Add Stanek charge")} subtract={(value) => runAction(() => {
          gift.fragments.forEach((fragment) => fragment.highestCharge -= value);
          snapshot.player.applyEntropy?.(snapshot.player.entropy);
          return "Stanek charge subtracted";
        }, "Subtract Stanek charge")} reset={() => runAction(() => {
          gift.fragments.forEach((fragment) => {
            fragment.highestCharge = 0;
            fragment.numCharge = 0;
          });
          return "Stanek charge reset";
        }, "Reset Stanek charge")}></Adjuster>
      </Line>
    </span>
  );
}

function TimeSkipTools({ snapshot, runAction }) {
  const React = getReactLib();
  const [minutes, setMinutes] = React.useState("");
  return (
    <Line label={"Skip:"}>
      <input style={smallInputStyle} title={"minutes to skip"} placeholder={"minutes"} value={minutes} type="number" onChange={(event) => setMinutes(event.target.value)}></input>
      <ActionButton text={"Skip minutes"} onClick={() => runAction(() => {
        const amount = safeNumber(minutes, 0);
        if (amount <= 0) return "Enter minutes to skip";
        applyTimeSkip(snapshot, amount * 60 * 1000);
        return "Time skip applied: " + formatNumber(amount) + " minute(s)";
      }, "Time skip minutes")}></ActionButton>
      {[
        ["1 minute", 60 * 1000],
        ["1 hour", 60 * 60 * 1000],
        ["1 day", 24 * 60 * 60 * 1000],
      ].map(([label, time]) => <ActionButton key={label} text={label} onClick={() => runAction(() => {
        applyTimeSkip(snapshot, time);
        return "Time skip applied: " + label;
      }, "Time skip")}></ActionButton>)}
    </Line>
  );
}

function applyTimeSkip(snapshot, time) {
  snapshot.player.lastUpdate -= time;
  if (snapshot.game.Engine) snapshot.game.Engine._lastUpdate -= time;
}

function AchievementTools({ snapshot, runAction }) {
  const React = getReactLib();
  const achievements = objectValues(snapshot.game.achievements).filter((item) => item?.ID);
  const [achievementId, setAchievementId] = React.useState(achievements[0]?.ID ?? "");
  const selected = achievements.find((item) => item.ID === achievementId);
  return (
    <span>
      <Line label={"Achievements:"}>
        <ActionButton text={"Grant All"} onClick={() => runAction(() => {
          achievements.forEach((ach) => snapshot.player.giveAchievement?.(ach.ID));
          return "All achievements granted";
        }, "Grant all achievements")}></ActionButton>
        <ActionButton text={"Clear"} style={redStyle} onClick={() => runAction(() => {
          snapshot.player.achievements = [];
          return "Achievements cleared";
        }, "Clear achievements")}></ActionButton>
        <ActionButton text={"Disable Engine Check"} onClick={() => runAction(() => {
          if (snapshot.game.Engine?.Counters) snapshot.game.Engine.Counters.achievementsCounter = Number.MAX_VALUE;
          return "Achievement engine check disabled";
        }, "Disable achievement check")}></ActionButton>
        <ActionButton text={"Enable Engine Check"} onClick={() => runAction(() => {
          if (snapshot.game.Engine?.Counters) snapshot.game.Engine.Counters.achievementsCounter = 0;
          return "Achievement engine check enabled";
        }, "Enable achievement check")}></ActionButton>
      </Line>
      <Line label={"One:"}>
        <SelectBox value={achievementId} options={achievements.map((ach) => ach.ID)} onChange={setAchievementId} width={280}></SelectBox>
        <ActionButton text={"Grant"} onClick={() => runAction(() => {
          snapshot.player.giveAchievement?.(achievementId);
          return "Achievement granted";
        }, "Grant achievement")}></ActionButton>
        <ActionButton text={"Clear"} style={redStyle} onClick={() => runAction(() => {
          snapshot.player.achievements = snapshot.player.achievements.filter((ach) => ach.ID !== achievementId);
          return "Achievement cleared";
        }, "Clear achievement")}></ActionButton>
        <span style={miniMetaStyle}>{selected ? " " + selected.Name : ""}</span>
      </Line>
    </span>
  );
}

function EntropyTools({ snapshot, runAction }) {
  const React = getReactLib();
  const player = snapshot.player;
  return (
    <Line label={"Entropy: " + formatNumber(player.entropy ?? 0)}>
      <Adjuster label={"entropy"} placeholder={"entropy"} tons={() => runAction(() => {
        player.entropy += 1e12;
        player.applyEntropy?.(player.entropy);
        return "Entropy added";
      }, "Entropy")} add={(value) => runAction(() => {
        player.entropy += value;
        player.applyEntropy?.(player.entropy);
        return "Entropy added";
      }, "Add entropy")} subtract={(value) => runAction(() => {
        player.entropy -= value;
        player.applyEntropy?.(player.entropy);
        return "Entropy subtracted";
      }, "Subtract entropy")} reset={() => runAction(() => {
        player.entropy = 0;
        player.applyEntropy?.(player.entropy);
        return "Entropy reset";
      }, "Reset entropy")}></Adjuster>
    </Line>
  );
}

function DarknetTools({ snapshot, runAction }) {
  const React = getReactLib();
  const [darkType, setDarkType] = React.useState("RANDOM");
  const [darkCount, setDarkCount] = React.useState("1");
  const [darkDifficulty, setDarkDifficulty] = React.useState("1");
  const [darkDepth, setDarkDepth] = React.useState("1");
  const state = snapshot.game.DarknetState;
  const darkServers = snapshot.servers.filter((server) => isDarknetServerLike(server));
  return (
    <span>
      <Line label={"Network:"}>
        <ActionButton text={state?.showFullNetwork ? "Hide Full Network" : "Show Full Network"} onClick={() => runAction(() => {
          if (state) {
            state.showFullNetwork = !state.showFullNetwork;
            snapshot.game.DarknetEvents?.emit?.();
          }
          return state ? "Darknet full-network toggled" : "Darknet state was not found";
        }, "Toggle full darknet")}></ActionButton>
        <ActionButton text={"Get DarkscapeNavigator"} onClick={() => runAction(() => {
          if (snapshot.game.funcs.getDarkscapeNavigator) snapshot.game.funcs.getDarkscapeNavigator();
          else pushProgram(snapshot.home, "DarkscapeNavigator.exe");
          return "DarkscapeNavigator granted";
        }, "Get Darkscape")}></ActionButton>
      </Line>
      <Line label={"Generation:"}>
        <ActionButton text={"Generate New Dark Network"} onClick={() => runAction(() => {
          let funcs = snapshot.game.funcs;
          if (!funcs.clearDarknet || !funcs.populateDarknet) {
            exposeInternalGameObjects(true);
            funcs = globalThis.__devMenuTestBridge?.funcs ?? funcs;
          }
          const missing = missingDarknetHelpers(funcs, ["clearDarknet", "populateDarknet"]);
          if (missing.length) return "Darknet generator helpers were not found. Missing: " + missing.join(", ");
          funcs.clearDarknet();
          funcs.populateDarknet();
          (globalThis.__devMenuTestBridge?.DarknetEvents ?? snapshot.game.DarknetEvents)?.emit?.();
          return "New dark network generated";
        }, "Generate darknet")}></ActionButton>
        <ActionButton text={"Shuffle Server Locations"} onClick={() => runAction(() => {
          return shuffleDarknetServers(snapshot, darkServers);
        }, "Shuffle darknet")}></ActionButton>
      </Line>
      <Line label={"Add Server:"}>
        <span style={fieldGroupStyle}><span style={fieldLabelStyle}>{"Type"}</span><SelectBox value={darkType} options={DARKNET_SERVER_TYPES} onChange={setDarkType} width={230}></SelectBox></span>
        <span style={fieldGroupStyle}><span style={fieldLabelStyle}>{"Count"}</span><input style={tinyInputStyle} title={"count"} placeholder={"1"} value={darkCount} type="number" onChange={(event) => setDarkCount(event.target.value)}></input></span>
        <span style={fieldGroupStyle}><span style={fieldLabelStyle}>{"Difficulty"}</span><input style={tinyInputStyle} title={"difficulty"} placeholder={"1"} value={darkDifficulty} type="number" onChange={(event) => setDarkDifficulty(event.target.value)}></input></span>
        <span style={fieldGroupStyle}><span style={fieldLabelStyle}>{"Depth"}</span><input style={tinyInputStyle} title={"depth"} placeholder={"1"} value={darkDepth} type="number" onChange={(event) => setDarkDepth(event.target.value)}></input></span>
        <ActionButton text={"Add Server(s)"} onClick={() => runAction(() => {
          const count = Math.max(1, Math.floor(safeNumber(darkCount, 1)));
          const difficulty = Math.max(0, Math.floor(safeNumber(darkDifficulty, 1)));
          const depth = Math.max(0, Math.floor(safeNumber(darkDepth, difficulty)));
          return addDarknetServers(snapshot, darkType, count, difficulty, depth);
        }, "Add darknet servers")}></ActionButton>
      </Line>
      <Line label={"Access:"}>
        <ActionButton text={"Root darknet"} onClick={() => runAction(() => {
          if (snapshot.game.funcs.handleSuccessfulAuth) darkServers.forEach((server) => snapshot.game.funcs.handleSuccessfulAuth(server, 1, -1));
          else darkServers.forEach(rootServer);
          return "Darknet servers rooted";
        }, "Root darknet")}></ActionButton>
        <ActionButton text={"Backdoor darknet"} onClick={() => runAction(() => {
          darkServers.forEach((server) => server.backdoorInstalled = true);
          return "Darknet servers backdoored";
        }, "Backdoor darknet")}></ActionButton>
        <ActionButton text={"START WEBSTORM"} style={redStyle} onClick={() => runAction(() => {
          return startWebstorm(snapshot, darkServers);
        }, "Webstorm")}></ActionButton>
      </Line>
      <Line label={"Found:"}>
        <span style={miniMetaStyle}>{darkServers.length + " darknet-like servers visible to this script"}</span>
      </Line>
    </span>
  );
}

function addDarknetServers(snapshot, type, count, difficulty, depth) {
  const funcs = getFreshDarknetFuncs(snapshot, type === "RANDOM" ? ["createDarknetServer", "moveDarknetServer", "addRandomDarknetServers"] : ["serverFactory", "moveDarknetServer"]);
  if (type === "RANDOM") {
    if (funcs.createDarknetServer && funcs.moveDarknetServer) {
      let success = 0;
      const range = Math.max(3, Math.ceil(count / 4));
      for (let i = 0; i < count; i++) {
        const server = funcs.createDarknetServer(difficulty, -1, -1);
        success += funcs.moveDarknetServer(server, range, range, depth) ? 1 : 0;
      }
      getFreshDarknetEvents(snapshot)?.emit?.();
      return "Added " + success + " random darknet server(s)";
    }
    if (funcs.addRandomDarknetServers) {
      funcs.addRandomDarknetServers(count, difficulty, true);
      getFreshDarknetEvents(snapshot)?.emit?.();
      return "Added " + count + " random darknet server(s)";
    }
    return "Darknet random-server helper was not found. Missing: " + missingDarknetHelpers(funcs, ["createDarknetServer", "moveDarknetServer", "addRandomDarknetServers"]).join(", ");
  }
  const builder = (globalThis.__devMenuTestBridge?.darknetConfigBuilders ?? snapshot.game.darknetConfigBuilders)?.[type];
  if (!builder || !funcs.serverFactory || !funcs.moveDarknetServer) return "Specific darknet server helpers were not found for " + type + ". Missing: " + missingDarknetHelpers({ ...funcs, builder }, ["builder", "serverFactory", "moveDarknetServer"]).join(", ");
  let success = 0;
  const range = Math.max(3, Math.ceil(count / 4));
  for (let i = 0; i < count; i++) {
    const server = funcs.serverFactory(builder, difficulty, -1, -1);
    success += funcs.moveDarknetServer(server, range, range, depth) ? 1 : 0;
  }
  getFreshDarknetEvents(snapshot)?.emit?.();
  return "Added " + success + " " + type + " darknet server(s)";
}

function shuffleDarknetServers(snapshot, darkServers) {
  const funcs = getFreshDarknetFuncs(snapshot, ["moveRandomDarknetServers", "moveDarknetServer"]);
  const allDarknetServers = getAllDarknetServersForDev(snapshot, darkServers);
  const count = Math.floor(allDarknetServers.length / 2);
  if (funcs.moveRandomDarknetServers) {
    funcs.moveRandomDarknetServers(count);
    //refreshDarknetUi(snapshot);
    return "Darknet servers shuffled";
  }
  if (funcs.moveDarknetServer) {
    let moved = 0;
    const movableServers = getMovableDarknetServers(snapshot, darkServers);
    for (const server of shuffleArray(movableServers).slice(0, count)) {
      const oldDepth = server.depth;
      const oldOffset = server.leftOffset;
      const didMove = funcs.moveDarknetServer(server);
      if (didMove && (server.depth !== oldDepth || server.leftOffset !== oldOffset)) moved++;
    }
    //refreshDarknetUi(snapshot);
    return "Darknet servers shuffled (" + moved + "/" + movableServers.length + " moved)";
  }
  return "Darknet movement helper was not found. Missing: " + missingDarknetHelpers(funcs, ["moveRandomDarknetServers", "moveDarknetServer"]).join(", ");
}

function getAllDarknetServersForDev(snapshot, darkServers) {
  try {
    const game = globalThis.__devMenuTestBridge ?? snapshot.game;
    const servers = getAllServers(game).filter(isDarknetServerLike);
    if (servers.length) return servers;
  } catch { }
  return darkServers ?? [];
}

function getMovableDarknetServers(snapshot, darkServers) {
  const state = globalThis.__devMenuTestBridge?.DarknetState ?? snapshot.game?.DarknetState;
  const servers = getAllDarknetServersForDev(snapshot, darkServers);
  return servers.filter((server) => {
    if (!server || server === state?.openServer) return false;
    if (server.isStationary || server.hasStasisLink || server.isConnectedTo) return false;
    if (!Number.isFinite(server.depth) || server.depth < 0) return false;
    if (!Number.isFinite(server.leftOffset) || server.leftOffset < 0) return false;
    return true;
  });
}

function refreshDarknetUi(snapshot) {
  const state = globalThis.__devMenuTestBridge?.DarknetState ?? snapshot.game?.DarknetState;
  try {
    state?.nextMutationResolver?.();
    if (state && "nextMutation" in state) {
      state["nextMutation"] = new Promise((resolve) => {
        state.nextMutationResolver = resolve;
      });
    }
  } catch { }
  getFreshDarknetEvents(snapshot)?.emit?.();
}

function startWebstorm(snapshot, darkServers) {
  const funcs = getFreshDarknetFuncs(snapshot, [
    "deleteRandomDarknetServers",
    "moveRandomDarknetServers",
    "restartAllDarknetServers",
    "addRandomDarknetServers",
    "balanceDarknetServers",
    "validateDarknetNetwork",
    "launchWebstorm",
  ]);
  const manualHelpers = ["deleteRandomDarknetServers", "moveRandomDarknetServers", "restartAllDarknetServers", "addRandomDarknetServers", "balanceDarknetServers"];
  const missingManual = missingDarknetHelpers(funcs, manualHelpers);
  if (!missingManual.length) {
    startManualWebstorm(snapshot, darkServers, funcs);
    return "Webstorm launched without game UI hooks";
  }
  if (funcs.launchWebstorm) {
    const launched = funcs.launchWebstorm(true);
    if (launched?.catch) launched.catch((error) => console.error(error));
    return "Webstorm launched with suppressed game toast";
  }
  return "Webstorm helpers were not found. Missing: " + missingManual.join(", ");
}

function startManualWebstorm(snapshot, darkServers, funcs) {
  const state = globalThis.__devMenuTestBridge?.DarknetState ?? snapshot.game?.DarknetState;
  if (state?.mutationLock) return;
  let cancelled = false;
  if (state) {
    state.mutationLock = () => {
      cancelled = true;
      state.mutationLock = null;
    };
  }
  const finish = () => {
    if (state?.mutationLock) state.mutationLock = null;
  };
  const phase = (delay, action, final = false) => {
    setTimeout(() => {
      if (cancelled) return;
      try {
        action();
        funcs.validateDarknetNetwork?.();
        getFreshDarknetEvents(snapshot)?.emit?.();
      } catch (error) {
        cancelled = true;
        console.error(error);
      } finally {
        if (final || cancelled) finish();
      }
    }, delay);
  };
  const netWidth = state?.Network?.[0]?.length || 8;
  const currentCount = () => {
    const game = globalThis.__devMenuTestBridge ?? snapshot.game;
    try {
      return getAllServers(game).filter(isDarknetServerLike).length || darkServers.length || netWidth;
    } catch {
      return darkServers.length || netWidth;
    }
  };
  const estimatedDepth = () => Math.max(1, Math.ceil(currentCount() / Math.max(1, netWidth * 0.6)));

  phase(5000, () => {
    const serversToDelete = Math.max(0, currentCount() * 0.6 + (Math.random() * estimatedDepth() - 6));
    funcs.deleteRandomDarknetServers(serversToDelete);
    funcs.moveRandomDarknetServers(Math.max(1, (currentCount() - serversToDelete) * 0.6));
    funcs.restartAllDarknetServers();
  });
  phase(9000, () => funcs.addRandomDarknetServers(netWidth));
  phase(13000, () => funcs.addRandomDarknetServers(netWidth * 2));
  phase(17000, () => funcs.addRandomDarknetServers(netWidth * 2));
  phase(25000, () => funcs.balanceDarknetServers(), true);
}

function getFreshDarknetFuncs(snapshot, required = []) {
  let funcs = snapshot.game?.funcs ?? {};
  if (required.some((name) => !isUsableBridgeValue(funcs[name]))) {
    exposeInternalGameObjects(true);
    funcs = globalThis.__devMenuTestBridge?.funcs ?? funcs;
  }
  for (const [name, value] of objectEntries(funcs)) {
    if (typeof value === "function" && !isCallableHelper(value)) delete funcs[name];
  }
  return funcs;
}

function getFreshDarknetEvents(snapshot) {
  return globalThis.__devMenuTestBridge?.DarknetEvents ?? snapshot.game?.DarknetEvents;
}

function shuffleArray(values) {
  const copy = [...values];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function missingDarknetHelpers(record, names) {
  return names.filter((name) => !isUsableBridgeValue(record?.[name]));
}

function isUsableBridgeValue(value) {
  if (!value) return false;
  return typeof value !== "function" || isCallableHelper(value);
}

function isDarknetServerLike(server) {
  return !!server && typeof server === "object" && ("modelId" in server || "passwordHintData" in server || "leftOffset" in server) && "depth" in server;
}

function ExtraTools({ snapshot, runAction }) {
  const React = getReactLib();
  return (
    <span>
      <Line label={"One-click:"}>
        <ActionButton text={"Root + Max All Servers"} onClick={() => runAction(() => {
          snapshot.servers.filter(isMutableServer).forEach((server) => {
            rootServer(server);
            if ("moneyMax" in server) server.moneyAvailable = server.moneyMax;
            if ("minDifficulty" in server) server.hackDifficulty = server.minDifficulty;
          });
          return "Servers rooted, maxed, and weakened";
        }, "Root/max all")}></ActionButton>
        <ActionButton text={"Starter Package"} onClick={() => runAction(() => {
          snapshot.player.gainMoney(1e12, "other");
          snapshot.programs.forEach((name) => pushProgram(snapshot.home, name));
          snapshot.servers.filter(isMutableServer).forEach(rootServer);
          return "Starter package applied";
        }, "Starter package")}></ActionButton>
      </Line>
      <Line label={"Debug:"}>
        <ActionButton text={"Rescan Webpack"} onClick={() => runAction(() => {
          exposeInternalGameObjects(true);
          return "Webpack bridge rescanned";
        }, "Rescan webpack")}></ActionButton>
      </Line>
    </span>
  );
}

function ActionButton({ text, onClick, style }) {
  const React = getReactLib();
  return <button style={{ ...rowButtonBaseStyle, ...(style ?? alwaysOnStyle) }} onClick={onClick}>{text}</button>;
}

function Adjuster({ label, placeholder, tons, add, subtract, reset }) {
  const React = getReactLib();
  const [value, setValue] = React.useState("");
  const numberValue = () => safeNumber(value);
  return (
    <span style={adjusterWrapStyle}>
      <input title={label} placeholder={placeholder} style={smallInputStyle} value={value} type="number" onChange={(event) => setValue(event.target.value)}></input>
      <ActionButton text={"Tons"} onClick={tons}></ActionButton>
      <ActionButton text={"+"} onClick={() => add(numberValue())}></ActionButton>
      <ActionButton text={"-"} onClick={() => subtract(numberValue())}></ActionButton>
      <ActionButton text={"Reset"} style={redStyle} onClick={reset}></ActionButton>
    </span>
  );
}

function SelectBox({ value, options, onChange, width }) {
  const React = getReactLib();
  const selectWidth = getSelectWidth(options, width);
  return (
    <select style={{ ...selectStyle, width: selectWidth }} value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => <option key={String(option)} value={option} style={optionStyle}>{String(option)}</option>)}
    </select>
  );
}

function getSelectWidth(options, maxWidth) {
  const longest = Math.max(3, ...(options ?? []).map((option) => String(option).length));
  const width = Math.max(62, Math.min(420, longest * 8 + 34));
  return maxWidth ? Math.min(maxWidth, width) : width;
}

function Line({ label, children }) {
  const React = getReactLib();
  return (
    <div style={lineStyle}>
      <span style={lineLabelStyle}>{label}</span>
      <span style={lineBodyStyle}>{children}</span>
    </div>
  );
}

function normalizeRowContent(node) {
  const React = getReactLib();
  if (!React || node === null || node === undefined || typeof node === "boolean") return node;
  if (typeof node === "string" || typeof node === "number") return node;
  if (!React.isValidElement(node)) return node;
  const childProps = node.props ?? {};
  const normalizedChildren = React.Children.map(childProps.children, (child) => normalizeRowContent(child));
  if (typeof node.type === "string" && node.type.toLowerCase() === "button") {
    return React.cloneElement(node, { ...childProps, style: { ...rowButtonBaseStyle, ...(childProps.style ?? {}) } }, normalizedChildren);
  }
  return React.cloneElement(node, childProps, normalizedChildren);
}

function Row({ row, onHideToggle }) {
  const React = getReactLib();
  const title = row.title;
  const normalizedButtons = normalizeRowContent(row.body);
  const hideToggle = <input type="checkbox" checked={true} title={"Uncheck to hide " + title} style={rowHideCheckboxStyle} onClick={(event) => event.stopPropagation()} onMouseDown={(event) => event.stopPropagation()} onChange={() => onHideToggle(title)}></input>;
  const titleWithHide = <span>{title}{hideToggle}</span>;
  return (
    <div data-row={title}>
      <details open={openDB.has(title)} onToggle={(event) => {
        if (event.currentTarget.open) openDB.add(title);
        else openDB.delete(title);
      }}>
        <summary style={summaryStyle}>{titleWithHide}</summary>
        <div style={rowBodyStyle}>{normalizedButtons}</div>
      </details>
    </div>
  );
}

function MiniView({ rows, selectedRows, onToggleRow, onHideToggle, rowVersion }) {
  const React = getReactLib();
  const openRows = rows.filter((row) => selectedRows.includes(row.title));
  if (rows.length === 0) return <div style={miniEmptyStateStyle}>{"No rows are currently available in Mini view."}</div>;
  return (
    <div>
      <div style={miniHintStyle}>{"Left Click to enable. Right Click to hide."}</div>
      <div style={miniRowSelectorWrapStyle}>
        {rows.map((row) => <button key={row.title} data-nohover="true" style={selectedRows.includes(row.title) ? miniRowSelectorActiveStyle : miniRowSelectorButtonStyle} onClick={() => onToggleRow(row.title)} onContextMenu={(event) => {
          event.preventDefault();
          onHideToggle(row.title);
        }}>{row.title}</button>)}
      </div>
      {openRows.length === 0
        ? <div style={miniEmptyStateStyle}>{"Select one or more rows above to show them here."}</div>
        : openRows.map((row) => <MiniRowPanel key={row.title + "-" + rowVersion} row={row} onHideToggle={onHideToggle}></MiniRowPanel>)}
    </div>
  );
}

function MiniRowPanel({ row, onHideToggle }) {
  const React = getReactLib();
  return (
    <div data-row={row.title} style={miniRowPanelStyle}>
      <div style={miniRowPanelHeaderStyle}>
        <div style={miniRowTitleWrapStyle}>
          <div style={miniRowPanelTitleStyle}>{row.title}</div>
          <label style={miniRowHideWrapStyle}>
            <input type="checkbox" checked={true} style={miniRowHideCheckboxStyle} onChange={() => onHideToggle(row.title)}></input>
            {"Visible"}
          </label>
        </div>
      </div>
      <div style={rowBodyStyle}>{normalizeRowContent(row.body)}</div>
    </div>
  );
}

const appStyle = {
  fontFamily: "monospace",
  fontSize: 12,
  lineHeight: 1.25,
};
const greenStyle = {
  backgroundColor: "var(--bb-theme-primarydark)",
  color: "var(--bb-theme-backgroundprimary)",
};
const redStyle = {
  backgroundColor: "var(--bb-theme-error)",
  color: "var(--bb-theme-backgroundprimary)",
};
const alwaysOnStyle = {
  backgroundColor: "var(--bb-theme-cha)",
  color: "var(--bb-theme-backgroundprimary)",
};
const rowHideCheckboxStyle = {
  marginLeft: 8,
  verticalAlign: "middle",
};
const rowBodyStyle = {
  paddingTop: 6,
  paddingBottom: 2,
};
const summaryStyle = {
  fontSize: 18,
  cursor: "pointer",
};
const rowButtonBaseStyle = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 54,
  height: 28,
  padding: "2px 7px",
  marginRight: 4,
  marginBottom: 4,
  borderRadius: 4,
  border: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
  textAlign: "center",
  whiteSpace: "normal",
  fontSize: 12,
  lineHeight: 1.05,
  overflow: "hidden",
  verticalAlign: "middle",
  cursor: "pointer",
};
const topPanelWrapStyle = {
  position: "relative",
  marginBottom: 10,
  padding: "10px 12px 12px 12px",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))",
};
const topPanelInfoStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 10,
  flexWrap: "wrap",
  marginBottom: 10,
};
const topPanelTitleStyle = {
  fontSize: 18,
  fontWeight: "bold",
};
const topPanelMetaStyle = {
  opacity: 0.8,
  fontSize: 12,
  lineHeight: 1.3,
};
const displayStatusTrayStyle = {
  display: "flex",
  gap: 6,
  flexWrap: "wrap",
};
const displayStatusBaseStyle = {
  appearance: "none",
  padding: "3px 8px",
  borderRadius: 999,
  fontSize: 11,
  fontWeight: "bold",
  border: "1px solid rgba(255,255,255,0.12)",
};
const displayStatusMutedStyle = {
  ...displayStatusBaseStyle,
  backgroundColor: "var(--bb-theme-infodark)",
  color: "var(--bb-theme-secondarylight)",
};
const displayStatusWarnStyle = {
  ...displayStatusBaseStyle,
  backgroundColor: "var(--bb-theme-warning)",
  color: "var(--bb-theme-backgroundprimary)",
};
const toolbarBarStyle = {
  display: "flex",
  gap: 8,
  alignItems: "center",
  flexWrap: "wrap",
  paddingTop: 8,
  borderTop: "1px solid rgba(255,255,255,0.08)",
};
const viewModeToggleWrapStyle = {
  display: "inline-flex",
  gap: 6,
  alignItems: "center",
  padding: 3,
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(255,255,255,0.04)",
};
const viewModeLabelStyle = {
  fontSize: 12,
  fontWeight: "bold",
  opacity: 0.82,
  paddingLeft: 4,
};
const viewModeButtonStyle = {
  appearance: "none",
  cursor: "pointer",
  borderRadius: 6,
  padding: "7px 12px",
  border: "1px solid rgba(255,255,255,0.1)",
  backgroundColor: "rgba(255,255,255,0.06)",
  color: "var(--bb-theme-primary)",
  fontWeight: "bold",
};
const viewModeButtonActiveStyle = {
  ...viewModeButtonStyle,
  backgroundColor: "var(--bb-theme-primarydark)",
  color: "var(--bb-theme-backgroundprimary)",
};
const viewModeMiniActiveStyle = {
  ...viewModeButtonStyle,
  backgroundColor: "var(--bb-theme-cha)",
  color: "var(--bb-theme-backgroundprimary)",
};
const toolbarMenuStyle = {
  position: "relative",
};
const toolbarSummaryStyle = {
  appearance: "none",
  listStyle: "none",
  cursor: "pointer",
  userSelect: "none",
  borderRadius: 6,
  padding: "7px 12px",
  border: "1px solid rgba(255,255,255,0.1)",
  backgroundColor: "var(--bb-theme-secondarylight)",
  fontWeight: "bold",
};
const toolbarSummaryOpenStyle = {
  ...toolbarSummaryStyle,
  backgroundColor: "var(--bb-theme-info)",
  border: "1px solid rgba(138, 180, 255, 0.38)",
};
const toolbarDropdownStyle = {
  position: "absolute",
  top: "50%",
  left: "calc(100% + 4px)",
  transform: "translateY(-50%)",
  display: "flex",
  flexDirection: "column",
  gap: 8,
  padding: 10,
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.12)",
  backgroundColor: "rgba(10, 12, 18, 0.96)",
  boxShadow: "0 14px 30px rgba(0,0,0,0.35)",
  zIndex: 40,
  width: "24ch",
  maxHeight: 360,
  overflowY: "auto",
};
const toolbarSectionTitleStyle = {
  fontSize: 11,
  fontWeight: "bold",
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  opacity: 0.72,
};
const toolbarHintStyle = {
  fontSize: 12,
  opacity: 0.72,
  paddingLeft: 4,
};
const displayButtonBaseStyle = {
  display: "block",
  width: "100%",
  textAlign: "left",
  borderRadius: 6,
  padding: "6px 10px",
  border: "1px solid rgba(255,255,255,0.08)",
  boxShadow: "inset 0 1px 0 rgba(255,255,255,0.05)",
};
const displaySecondaryStyle = {
  ...displayButtonBaseStyle,
  backgroundColor: "var(--bb-theme-cha)",
  color: "var(--bb-theme-backgroundprimary)",
};
const displayDangerStyle = {
  ...displayButtonBaseStyle,
  backgroundColor: "var(--bb-theme-error)",
  color: "var(--bb-theme-white)",
};
const miniRowSelectorWrapStyle = {
  display: "flex",
  flexWrap: "wrap",
  gap: 4,
  marginBottom: 4,
  padding: "4px 6px",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.1)",
  background: "linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.025))",
};
const miniHintStyle = {
  fontSize: 11,
  fontWeight: "bold",
  opacity: 0.72,
  marginBottom: 2,
  paddingLeft: 2,
  lineHeight: 1.1,
};
const miniRowSelectorButtonStyle = {
  appearance: "none",
  cursor: "pointer",
  borderRadius: 999,
  padding: "3px 9px",
  border: "1px solid rgba(255,255,255,0.1)",
  backgroundColor: "rgba(255,255,255,0.05)",
  color: "var(--bb-theme-primary)",
  fontSize: 11,
  fontWeight: "bold",
};
const miniRowSelectorActiveStyle = {
  ...miniRowSelectorButtonStyle,
  backgroundColor: "var(--bb-theme-primarydark)",
  color: "var(--bb-theme-backgroundprimary)",
};
const miniRowPanelStyle = {
  marginBottom: 6,
  padding: "6px 8px",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.12)",
  background: "linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))",
};
const miniRowPanelHeaderStyle = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
  gap: 4,
  flexWrap: "wrap",
};
const miniRowTitleWrapStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  flexWrap: "wrap",
};
const miniRowPanelTitleStyle = {
  fontSize: 15,
  fontWeight: "bold",
};
const miniRowHideWrapStyle = {
  display: "inline-flex",
  alignItems: "center",
  fontSize: 11,
  opacity: 0.85,
};
const miniRowHideCheckboxStyle = {
  marginLeft: 0,
  marginRight: 4,
  verticalAlign: "middle",
};
const miniEmptyStateStyle = {
  padding: "6px 8px",
  borderRadius: 8,
  border: "1px solid rgba(255,255,255,0.08)",
  backgroundColor: "rgba(255,255,255,0.03)",
  opacity: 0.8,
};
const miniMetaStyle = {
  opacity: 0.75,
  fontSize: 11,
  marginLeft: 4,
};
const lineStyle = {
  display: "flex",
  alignItems: "flex-start",
  gap: 8,
  flexWrap: "wrap",
  marginBottom: 5,
};
const lineLabelStyle = {
  minWidth: 132,
  maxWidth: 210,
  paddingTop: 6,
  color: "var(--bb-theme-primary)",
  fontWeight: "bold",
};
const lineBodyStyle = {
  flex: "1 1 480px",
};
const inputStyle = {
  height: 26,
  minWidth: 150,
  marginRight: 4,
  marginBottom: 4,
  padding: "2px 6px",
  color: "var(--bb-theme-primary)",
  background: "rgba(255,255,255,0.05)",
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: 4,
  fontFamily: "monospace",
  fontSize: 12,
};
const smallInputStyle = {
  ...inputStyle,
  minWidth: 82,
  width: 92,
};
const tinyInputStyle = {
  ...inputStyle,
  minWidth: 44,
  width: 48,
};
const fieldGroupStyle = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  marginRight: 6,
  marginBottom: 4,
};
const fieldLabelStyle = {
  color: "var(--bb-theme-secondarylight)",
  fontSize: 11,
  fontWeight: "bold",
};
const selectStyle = {
  height: 30,
  marginRight: 4,
  marginBottom: 4,
  padding: "2px 6px",
  color: "var(--bb-theme-primary)",
  background: "#000",
  border: "1px solid rgba(255,255,255,0.15)",
  borderRadius: 4,
  fontFamily: "monospace",
  fontSize: 12,
};
const optionStyle = {
  background: "#000",
  color: "var(--bb-theme-primary)",
};
const adjusterWrapStyle = {
  display: "inline-flex",
  alignItems: "center",
  flexWrap: "wrap",
  marginRight: 6,
};
