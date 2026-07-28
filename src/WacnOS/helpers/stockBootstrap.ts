import {NS} from "@ns";

/**
 * Buys the stock market unlocks as they become affordable.
 *
 * These are worth calling out because they are the one genuinely lucrative money engine that
 * needs NO Source-File at all - purchaseWseAccount / purchaseTixApi / purchase4SMarketData* are
 * plain ns.stock calls. In BitNode 4, where hacking income is cut to roughly 2.25% of BN1, this
 * matters more than the hacking loop does.
 *
 * Args: [reserve] - money to leave untouched.
 *
 * Bought in ascending price so each unlock starts paying for the next: WSE account ($200m) ->
 * TIX API ($5b) -> 4S data ($1b) -> 4S TIX API ($25b). Note the API names changed in game version
 * 3.0.0: hasWSEAccount/hasTIXAPIAccess were removed in favour of hasWseAccount/hasTixApiAccess.
 */

const WSE_COST = 200e6;
const TIX_COST = 5e9;
const FOURS_COST = 1e9;
const FOURS_TIX_COST = 25e9;

export async function main(ns: NS): Promise<void> {
    const reserve = Number(ns.args[0] ?? 0);
    const bought: string[] = [];

    const money = () => ns.getServerMoneyAvailable("home") - reserve;

    if (!ns.stock.hasWseAccount() && money() >= WSE_COST && ns.stock.purchaseWseAccount()) {
        bought.push("WSE account");
    }
    if (ns.stock.hasWseAccount() && !ns.stock.has4SData() && money() >= FOURS_COST && ns.stock.purchase4SMarketData()) {
        bought.push("4S market data");
    }
    if (!ns.stock.hasTixApiAccess() && money() >= TIX_COST && ns.stock.purchaseTixApi()) {
        bought.push("TIX API");
    }
    if (ns.stock.hasTixApiAccess() && !ns.stock.has4SDataTixApi() && money() >= FOURS_TIX_COST && ns.stock.purchase4SMarketDataTixApi()) {
        bought.push("4S TIX API");
    }

    const state = {
        bought,
        wse: ns.stock.hasWseAccount(),
        tix: ns.stock.hasTixApiAccess(),
        fourS: ns.stock.has4SData(),
        fourSTix: ns.stock.has4SDataTixApi(),
    };
    ns.atExit(() => ns.writePort(ns.pid, state));
}
