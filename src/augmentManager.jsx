/** @param {NS} ns */
export async function main(ns) {
    ns.ui.setTailTitle("Augments");
    ns.ui.openTail();
    ns.disableLog("ALL");

    ns.clearLog();

    const NFG = "NeuroFlux Governor";
    const theme = ns.ui.getTheme();

    let timer = null;

    let options = {
        filterPrice: true,
        filterRep: true,
        filterJoined: true
    }

    ns.atExit(() => {
        if (timer) {
            clearInterval(timer);
        }
    })

    ns.printRaw(<AugmentTable/>);

    function AugmentTable() {
        const [player, setPlayer] = React.useState(ns.getPlayer());

        React.useEffect(() => {
            timer = setInterval(() => {
                setPlayer(ns.getPlayer());
            }, 100);
            return () => clearInterval(timer);
        }, []);

        const columns = ["Name", "Price", "Rep", "Factions"];
        let list = augmentList();
        list.sort(augmentSort);
        let augments = [];
        for (const item of list) {
            const data = getAugData(item);
            augments.push(data);
        }

        return (
            <div>
                <AugmentOptions/>
                <table border="1" style={{width: "100%"}}>
                    <AugmentHeader columns={columns}/>
                    <AugmentBody augments={augments} player={player}/>
                </table>
            </div>
        );
    }

    function AugmentOptions() {
        function handleChange(e) {
            const target = e.target
            const value = target.checked;
            const name = target.name;
            options[name] = value;
        }

        return (
            <div style={{
                position: "sticky",
                top: "-2px",
                left: "1px",
                width: "calc(100% - 2px)",
                backgroundColor: theme.backgroundsecondary
            }}>
                <label>Limit to:</label>
                <label>
                    <input type={`checkbox`} name={`filterPrice`} checked={options.filterPrice}
                           onChange={handleChange}/>
                    Price
                </label>
                <label>
                    <input type={`checkbox`} name={`filterRep`} checked={options.filterRep} onChange={handleChange}/>
                    Rep
                </label>
                <label>
                    <input type={`checkbox`} name={`filterJoined`} checked={options.filterJoined}
                           onChange={handleChange}/>
                    Joined Factions
                </label>
            </div>
        );
    }

    function AugmentHeader({columns}) {
        return (
            <thead>
            <tr>
                <th width="45px"/>
                {columns.map((column) => (
                    <th>{column}</th>
                ))}
            </tr>
            </thead>
        );
    }

    function AugmentBody({augments, player}) {
        let filtered = augments.filter(val => (
            (checkAugmentPrice(val, player) || !options.filterPrice) &&
            (checkAugmentRep(val, player) || !options.filterRep) &&
            (inFactionWithAugment(val, player) || !options.filterJoined)
        ))
        return (
            <tbody>
            {filtered.map((augment) => (
                <tr>
                    <td>
                        <AugmentBuy augment={augment} player={player}/>
                        {(augment.name == NFG ? <AugmentBuyAllNFG augment={augment} player={player}/> : ``)}
                    </td>
                    <AugmentName augment={augment}/>
                    <td style={{color: augmentMoneyColor(augment, player)}}>
                        {ns.ui.getGameInfo().versionNumber >= 44 ? ns.format.number(augment.price, 2) : ns.formatNumber(augment.price, 2)}
                    </td>
                    <td style={{color: augmentRepColor(augment, player)}}>
                        {ns.ui.getGameInfo().versionNumber >= 44 ? ns.format.number(augment.rep, 2) : ns.formatNumber(augment.rep, 2)}
                    </td>
                    <AugmentFactions augment={augment} player={player} showAll={!options.filterJoined}/>
                </tr>
            ))}
            </tbody>
        )
    }

    function AugmentBuy({augment, player}) {
        function handleClick() {
            for (const faction of player.factions) {
                if (ns.singularity.purchaseAugmentation(faction, augment.name))
                    break;
            }
        }

        return (
            <button onClick={handleClick} disabled={!augmentPurchasable(augment, player)}>Buy</button>
        );
    }

    function AugmentBuyAllNFG({augment, player}) {
        function handleClick() {
            let buyCount = 0;
            for (const faction of player.factions) {
                while (player.money >= augment.price && ns.singularity.getFactionRep(faction) >= augment.rep) {
                    if (!ns.singularity.purchaseAugmentation(faction, NFG)) {
                        break;
                    } else {
                        buyCount++;
                    }
                }
            }
            if (buyCount > 0)
                ns.toast(`Bought ${buyCount} ${NFG}.`)
        }

        return (
            <button onClick={handleClick} disabled={!augmentPurchasable(augment, player)}>All</button>
        );
    }

    function AugmentName({augment}) {
        return (
            <td>
                <div>
                    {(augment.factions.length == 1 ? `⭐` : ``) + augment.name}
                </div>
            </td>
        );
    }

    function AugmentFactions({augment, player, showAll}) {
        const filtered = augment.factions.filter(val => (player.factions.includes(val) || showAll));

        return (
            <td>
                {augment.name == NFG ? `ALL` : filtered.map((faction) => (
                    <div style={{color: augmentFactionColor(faction)}}>{faction}</div>
                ))}
            </td>
        );
    }

    function augmentMoneyColor(augment, player) {
        if (player.money > augment.price)
            return theme.success;
        else
            return theme.error;
    }

    function augmentRepColor(augment, player) {
        for (const faction of player.factions) {
            if (ns.singularity.getFactionRep(faction) >= augment.rep && augment.factions.includes(faction))
                return theme.success;
        }

        return theme.error;
    }

    function augmentFactionColor(faction) {
        const currentWork = ns.singularity.getCurrentWork();
        if (currentWork && currentWork.type == "FACTION") {
            if (faction == currentWork.factionName) {
                return theme.secondary;
            }
        }
        return theme.primary;
    }

    function augmentList() {
        let list = [NFG];
        let ownedAugs = ns.singularity.getOwnedAugmentations(true);

        for (const faction of Object.values(ns.enums.FactionName)) {
            const factionAugs = ns.singularity.getAugmentationsFromFaction(faction);
            for (const aug of factionAugs) {
                if (!list.includes(aug) && !ownedAugs.includes(aug))
                    list.push(aug);
            }
        }

        return list;
    }

    function augmentPurchasable(augment, player) {
        for (const requirement of ns.singularity.getAugmentationPrereq(augment.name)) {
            if (!ns.singularity.getOwnedAugmentations(true).includes(requirement))
                return false;
        }
        for (const faction of player.factions) {
            if (player.money >= augment.price &&
                ns.singularity.getFactionRep(faction) >= augment.rep &&
                augment.factions.includes(faction)) {
                return true;
            }
        }

        return false;
    }

    function checkAugmentPrice(augment, player) {
        if (player.money >= augment.price) {
            return true;
        }

        return false;
    }

    function checkAugmentRep(augment, player) {
        for (const faction of player.factions) {
            if (ns.singularity.getFactionRep(faction) >= augment.rep &&
                augment.factions.includes(faction)) {
                return true;
            }
        }

        return false;
    }

    function inFactionWithAugment(augment, player) {
        for (const faction of player.factions) {
            if (ns.singularity.getAugmentationFactions(augment.name).includes(faction))
                return true;
        }

        return false;
    }

    function getAugData(augment) {
        return {
            name: augment,
            price: ns.singularity.getAugmentationPrice(augment),
            rep: ns.singularity.getAugmentationRepReq(augment),
            factions: ns.singularity.getAugmentationFactions(augment)
        };
    }

    function augmentSort(a, b) {
        const priceA = ns.singularity.getAugmentationPrice(a),
            priceB = ns.singularity.getAugmentationPrice(b);
        return priceB - priceA;
    }

    return new Promise(() => {
    });
}
