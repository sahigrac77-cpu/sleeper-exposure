import { useState, useMemo } from "react";
import {
  Search,
  Loader2,
  ShieldAlert,
  Flame,
  Users,
  Layers,
  Trophy,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  TrendingUp,
  Zap,
  Target,
  BarChart3,
  CircleDot,
  DollarSign,
} from "lucide-react";

const FONT_HEAD = "'Barlow Condensed', sans-serif";
const FONT_BODY = "'Inter', sans-serif";

const COLORS = {
  bg: "#0A100D",
  surface: "#111A15",
  surfaceRaised: "#18231C",
  surfaceHover: "#1D2A22",
  line: "#26362C",
  lineLight: "#304337",
  turf: "#65C653",
  turfBright: "#91F276",
  rival: "#EF7048",
  rivalBright: "#FF9978",
  blue: "#55A8E8",
  yellow: "#E8C24F",
  purple: "#B98CE8",
  text: "#F1F6F1",
  textDim: "#91A297",
  textMuted: "#63736A",
};

async function getJSON(url) {
  const res = await fetch(url);

  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error(`Request failed (${res.status}) for ${url}`);
  }

  return res.json();
}

function positionColor(pos) {
  switch (pos) {
    case "QB":
      return "#E2643B";
    case "RB":
      return "#5FBF4C";
    case "WR":
      return "#4FA8E8";
    case "TE":
      return "#E8C24F";
    case "DEF":
      return "#8FA396";
    case "K":
      return "#B98CE8";
    default:
      return "#8FA396";
  }
}

function exposureLevel(pct) {
  if (pct >= 75) {
    return {
      label: "HEAVY",
      color: COLORS.rival,
      background: "rgba(239,112,72,0.10)",
    };
  }

  if (pct >= 50) {
    return {
      label: "HIGH",
      color: "#E8C24F",
      background: "rgba(232,194,79,0.10)",
    };
  }

  if (pct >= 25) {
    return {
      label: "MODERATE",
      color: COLORS.turf,
      background: "rgba(101,198,83,0.09)",
    };
  }

  return {
    label: "LOW",
    color: COLORS.textDim,
    background: "rgba(145,162,151,0.07)",
  };
}

/* =============================================================== */
/* LEAGUE TYPE */
/* =============================================================== */

function getLeagueType(league) {
  const settings = league?.settings || {};

  if (
    settings.best_ball === 1 ||
    settings.best_ball === true
  ) {
    return "Best Ball";
  }

  if (settings.type === 2) {
    return "Dynasty";
  }

  if (settings.type === 1) {
    return "Keeper";
  }

  if (settings.type === 0) {
    return "Redraft";
  }

  return "Other";
}

/* =============================================================== */
/* LEAGUE TYPE COLOR */
/* =============================================================== */

function leagueTypeColor(type) {
  switch (type) {
    case "Best Ball":
      return COLORS.purple;

    case "Dynasty":
      return COLORS.blue;

    case "Redraft":
      return COLORS.turf;

    case "Keeper":
      return COLORS.yellow;

    default:
      return COLORS.textDim;
  }
}

/* =============================================================== */
/* ROSTER RECORD (W / L / D) */
/* =============================================================== */

function computeRosterRecord(roster) {
  const settings = roster?.settings || {};

  const wins = settings.wins || 0;
  const losses = settings.losses || 0;
  const ties = settings.ties || 0;
  const totalGames = wins + losses + ties;

  const winPct =
    totalGames > 0
      ? (wins + ties * 0.5) / totalGames
      : null;

  const fpts =
    (settings.fpts || 0) +
    (settings.fpts_decimal || 0) / 100;

  const fptsAgainst =
    (settings.fpts_against || 0) +
    (settings.fpts_against_decimal || 0) / 100;

  return {
    wins,
    losses,
    ties,
    totalGames,
    winPct,
    fpts,
    fptsAgainst,
  };
}

function recordColor(winPct) {
  if (winPct === null || winPct === undefined) {
    return COLORS.textDim;
  }

  if (winPct > 0.5) return COLORS.turf;
  if (winPct < 0.5) return COLORS.rival;

  return COLORS.yellow;
}

function formatRecord({ wins, losses, ties }) {
  return ties > 0
    ? `${wins}-${losses}-${ties}`
    : `${wins}-${losses}`;
}

function formatWinPct(winPct) {
  if (winPct === null || winPct === undefined) {
    return "—";
  }

  return `${(winPct * 100).toFixed(1)}%`;
}

/* =============================================================== */
/* STANDINGS */
/* =============================================================== */

function computeStandings(rosters) {
  return (rosters || [])
    .map((roster) => ({
      roster,
      ...computeRosterRecord(roster),
    }))
    .sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      if (b.ties !== a.ties) return b.ties - a.ties;
      return (b.fpts || 0) - (a.fpts || 0);
    })
    .map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));
}

/* =============================================================== */
/* PLAYOFF PROJECTION */
/* =============================================================== */
/*
 * Sleeper's public API does not expose an official
 * "playoff odds" figure. This builds a straightforward
 * projection from current standings (rank, record, and
 * points for) plus each league's configured playoff
 * bracket size — the same inputs a manager would eyeball
 * on the standings page.
 */

function getPlayoffProjection({
  rank,
  totalTeams,
  playoffTeams,
}) {
  if (!totalTeams) {
    return {
      label: "No data",
      color: COLORS.textDim,
    };
  }

  const cutoff =
    playoffTeams && playoffTeams > 0
      ? playoffTeams
      : Math.max(2, Math.ceil(totalTeams / 2));

  if (rank === 1) {
    return {
      label: "Projected #1 seed",
      color: COLORS.yellow,
    };
  }

  if (rank <= cutoff) {
    return {
      label: "Projected playoff team",
      color: COLORS.turf,
    };
  }

  if (rank <= cutoff + 2) {
    return {
      label: "On the bubble",
      color: COLORS.blue,
    };
  }

  return {
    label: "Projected to miss playoffs",
    color: COLORS.rival,
  };
}

/* =============================================================== */
/* LOCAL STORAGE */
/* =============================================================== */

function getFeeStorageKey(userId, season) {
  return `sleeperLeagueFees:${userId}:${season}`;
}

function loadSavedFees(userId, season) {
  try {
    const key = getFeeStorageKey(
      userId,
      season
    );

    const saved = localStorage.getItem(key);

    if (!saved) {
      return {};
    }

    const parsed = JSON.parse(saved);

    return parsed &&
      typeof parsed === "object"
      ? parsed
      : {};
  } catch (err) {
    console.warn(
      "Could not load saved league fees.",
      err
    );

    return {};
  }
}

function saveFees(userId, season, fees) {
  try {
    const key = getFeeStorageKey(
      userId,
      season
    );

    localStorage.setItem(
      key,
      JSON.stringify(fees)
    );
  } catch (err) {
    console.warn(
      "Could not save league fees.",
      err
    );
  }
}

function formatMoney(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "$0.00";
  }

  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  ).format(number);
}

/* =============================================================== */
/* MAIN APP */
/* =============================================================== */

export default function SleeperExposure() {
  const [username, setUsername] = useState("");
  const [season, setSeason] = useState("2026");
  const [week, setWeek] = useState("1");

  const [status, setStatus] = useState("idle");
  const [statusMsg, setStatusMsg] = useState("");
  const [data, setData] = useState(null);

  const [sortKey, setSortKey] = useState("count");
  const [expanded, setExpanded] = useState(null);

  // Which league row (inside an expanded player) is open
  // to show full league standings. Keyed `${pid}:${leagueId}`.
  const [expandedLeague, setExpandedLeague] =
    useState(null);

  // Exposure filters
  const [leagueTypeFilter, setLeagueTypeFilter] =
    useState("all");

  const [positionFilter, setPositionFilter] =
    useState("all");

  // Main tabs
  const [activeTab, setActiveTab] =
    useState("exposure");

  // League tracker
  const [entryFees, setEntryFees] =
    useState({});

  const [
    trackerLeagueTypeFilter,
    setTrackerLeagueTypeFilter,
  ] = useState("all");

  const [trackerSearch, setTrackerSearch] =
    useState("");

  const canSubmit =
    username.trim().length > 0 &&
    status !== "loading";

  /* ============================================================= */
  /* RUN ANALYSIS */
  /* ============================================================= */

  async function runAnalysis(e) {
    e && e.preventDefault();

    if (!canSubmit) return;

    setStatus("loading");
    setData(null);
    setExpanded(null);
    setExpandedLeague(null);

    // Reset exposure filters
    setLeagueTypeFilter("all");
    setPositionFilter("all");

    // Reset tracker controls
    setTrackerLeagueTypeFilter("all");
    setTrackerSearch("");
    setActiveTab("exposure");

    try {
      setStatusMsg(
        "Looking up your Sleeper account…"
      );

      const user = await getJSON(
        `https://api.sleeper.app/v1/user/${encodeURIComponent(
          username.trim()
        )}`
      );

      if (!user) {
        setStatus("error");
        setStatusMsg(
          `No Sleeper user found for "${username.trim()}". Check the spelling and try again.`
        );
        return;
      }

      setStatusMsg("Finding your leagues…");

      const leagues = await getJSON(
        `https://api.sleeper.app/v1/user/${user.user_id}/leagues/nfl/${season}`
      );

      if (!leagues || leagues.length === 0) {
        setStatus("error");
        setStatusMsg(
          `${user.display_name || user.username} has no NFL leagues for the ${season} season.`
        );
        return;
      }

      setStatusMsg(
        "Loading the player database (one-time, ~5MB)…"
      );

      const playersMap = await getJSON(
        "https://api.sleeper.app/v1/players/nfl"
      );

      setStatusMsg(
        `Pulling rosters and matchups from ${leagues.length} league${
          leagues.length === 1 ? "" : "s"
        }…`
      );

      const leagueBundles = await Promise.all(
        leagues.map(async (league) => {
          const [
            rosters,
            users,
            matchups,
          ] = await Promise.all([
            getJSON(
              `https://api.sleeper.app/v1/league/${league.league_id}/rosters`
            ),
            getJSON(
              `https://api.sleeper.app/v1/league/${league.league_id}/users`
            ),
            getJSON(
              `https://api.sleeper.app/v1/league/${league.league_id}/matchups/${week}`
            ),
          ]);

          return {
            league,
            rosters: rosters || [],
            users: users || [],
            matchups: matchups || [],
          };
        })
      );

      const owned = leagueBundles
        .map((b) => {
          const myRoster = (
            b.rosters || []
          ).find(
            (r) =>
              r.owner_id === user.user_id
          );

          return myRoster
            ? {
                ...b,
                myRoster,
              }
            : null;
        })
        .filter(Boolean);

      if (owned.length === 0) {
        setStatus("error");
        setStatusMsg(
          `Found leagues for ${season}, but couldn't match a roster to this user. Try a different season.`
        );
        return;
      }

      const totalLeagues = owned.length;

      const exposure = {};
      const against = {};

      owned.forEach(
        ({
          league,
          rosters,
          users,
          matchups,
          myRoster,
        }) => {
          const teamName =
            users.find(
              (u) =>
                u.user_id === user.user_id
            )?.metadata?.team_name || null;

          const leagueType =
            getLeagueType(league);

          const myMatchup = matchups.find(
            (m) =>
              m.roster_id ===
              myRoster.roster_id
          );

          const myStarters = new Set(
            myMatchup
              ? myMatchup.starters
              : myRoster.starters || []
          );

          const allMyPlayers = myMatchup
            ? myMatchup.players
            : myRoster.players || [];

          /* ------------------------------------------------------- */
          /* MY PLAYERS */
          /* ------------------------------------------------------- */

          (allMyPlayers || []).forEach(
            (pid) => {
              if (!pid) return;

              if (!exposure[pid]) {
                exposure[pid] = {
                  count: 0,
                  starterCount: 0,
                  entries: [],
                  leagueTypes: {},
                };
              }

              exposure[pid].count += 1;

              exposure[pid].leagueTypes[
                leagueType
              ] =
                (exposure[pid].leagueTypes[
                  leagueType
                ] || 0) + 1;

              const isStarter =
                myStarters.has(pid);

              if (isStarter) {
                exposure[
                  pid
                ].starterCount += 1;
              }

              exposure[pid].entries.push({
                leagueId:
                  league.league_id,
                leagueName:
                  league.name,
                teamName,
                leagueType,
                starter: isStarter,
              });
            }
          );

          /* ------------------------------------------------------- */
          /* OPPONENTS */
          /* ------------------------------------------------------- */

          if (
            myMatchup &&
            myMatchup.matchup_id != null
          ) {
            const opponents =
              matchups.filter(
                (m) =>
                  m.matchup_id ===
                    myMatchup.matchup_id &&
                  m.roster_id !==
                    myRoster.roster_id
              );

            opponents.forEach((opp) => {
              (opp.starters || []).forEach(
                (pid) => {
                  if (!pid) return;

                  if (!against[pid]) {
                    against[pid] = {
                      count: 0,
                      starterCount: 0,
                      entries: [],
                    };
                  }

                  against[pid].count += 1;
                  against[
                    pid
                  ].starterCount += 1;

                  against[pid].entries.push({
                    leagueName:
                      league.name,
                    teamName,
                    starter: true,
                  });
                }
              );
            });
          }
        }
      );

      /*
       * Load previously saved entry fees for this
       * Sleeper account and season.
       */
      const savedFees =
        loadSavedFees(
          user.user_id,
          season
        );

      setEntryFees(savedFees);

      setData({
        user,
        season,
        week,

        /*
         * Keep ALL leagues separately for the
         * League Tracker.
         */
        allLeagues: leagues,

        totalAllLeagues:
          leagues.length,

        totalLeagues,
        owned,
        exposure,
        against,
        playersMap:
          playersMap || {},
      });

      setStatus("done");
      setStatusMsg("");
    } catch (err) {
      console.error(err);

      setStatus("error");
      setStatusMsg(
        "Something went wrong talking to Sleeper's API. Please try again in a moment."
      );
    }
  }

  /* ============================================================= */
  /* ENTRY FEE HANDLER */
  /* ============================================================= */

  function handleEntryFeeChange(
    leagueId,
    value
  ) {
    const nextFees = {
      ...entryFees,
      [leagueId]: value,
    };

    setEntryFees(nextFees);

    if (
      data?.user?.user_id &&
      data?.season
    ) {
      saveFees(
        data.user.user_id,
        data.season,
        nextFees
      );
    }
  }

  /* ============================================================= */
  /* PLAYER LOOKUP */
  /* ============================================================= */

  const lookupPlayer = (
    pid,
    playersMap
  ) => {
    if (
      pid &&
      /^[A-Z]{2,4}$/.test(pid) &&
      (!playersMap[pid] ||
        playersMap[pid].position === "DEF")
    ) {
      return {
        name: `${pid} D/ST`,
        position: "DEF",
        team: pid,
      };
    }

    const p = playersMap[pid];

    if (!p) {
      return {
        name: pid,
        position: "?",
        team: "",
      };
    }

    return {
      name:
        p.full_name ||
        `${p.first_name || ""} ${
          p.last_name || ""
        }`.trim() ||
        pid,
      position:
        p.position ||
        (p.fantasy_positions
          ? p.fantasy_positions[0]
          : "?"),
      team: p.team || "FA",
    };
  };

  /* ============================================================= */
  /* LEAGUE LOOKUP (for standings in the breakdown) */
  /* ============================================================= */

  const ownedByLeagueId = useMemo(() => {
    const map = {};

    (data?.owned || []).forEach((bundle) => {
      map[bundle.league.league_id] = bundle;
    });

    return map;
  }, [data]);

  /* ============================================================= */
  /* ALL EXPOSURE ROWS */
  /* ============================================================= */

  const exposureRows = useMemo(() => {
    if (!data) return [];

    const rows = Object.entries(
      data.exposure
    ).map(([pid, v]) => {
      const info = lookupPlayer(
        pid,
        data.playersMap
      );

      return {
        pid,
        ...info,
        ...v,
        pct: Math.round(
          (v.count / data.totalLeagues) * 100
        ),
      };
    });

    rows.sort((a, b) => {
      if (sortKey === "count") {
        return (
          b.count - a.count ||
          b.starterCount -
            a.starterCount
        );
      }

      if (sortKey === "starters") {
        return (
          b.starterCount -
            a.starterCount ||
          b.count - a.count
        );
      }

      return a.name.localeCompare(
        b.name
      );
    });

    return rows;
  }, [data, sortKey]);

  /* ============================================================= */
  /* FILTERED EXPOSURE ROWS */
  /* ============================================================= */

  const filteredExposureRows =
    useMemo(() => {
      if (!data) return [];

      const matchingLeagues =
        data.owned.filter(
          ({ league }) =>
            leagueTypeFilter === "all" ||
            getLeagueType(league) ===
              leagueTypeFilter
        );

      const matchingLeagueIds =
        new Set(
          matchingLeagues.map(
            ({ league }) =>
              league.league_id
          )
        );

      const denominator =
        matchingLeagues.length;

      const rows =
        exposureRows
          .map((row) => {
            const matchingEntries =
              row.entries.filter(
                (entry) =>
                  matchingLeagueIds.has(
                    entry.leagueId
                  )
              );

            const count =
              matchingEntries.length;

            const starterCount =
              matchingEntries.filter(
                (entry) =>
                  entry.starter
              ).length;

            return {
              ...row,
              entries: matchingEntries,
              count,
              starterCount,
              pct:
                denominator > 0
                  ? Math.round(
                      (count /
                        denominator) *
                        100
                    )
                  : 0,
            };
          })
          .filter((row) => {
            if (
              positionFilter !==
                "all" &&
              row.position !==
                positionFilter
            ) {
              return false;
            }

            if (row.count === 0) {
              return false;
            }

            return true;
          });

      rows.sort((a, b) => {
        if (sortKey === "count") {
          return (
            b.count - a.count ||
            b.starterCount -
              a.starterCount
          );
        }

        if (sortKey === "starters") {
          return (
            b.starterCount -
              a.starterCount ||
            b.count - a.count
          );
        }

        return a.name.localeCompare(
          b.name
        );
      });

      return rows;
    }, [
      data,
      exposureRows,
      leagueTypeFilter,
      positionFilter,
      sortKey,
    ]);

  /* ============================================================= */
  /* ROOT FOR */
  /* ============================================================= */

  const rootFor = useMemo(() => {
    if (!data) return [];

    return exposureRows
      .filter(
        (r) => r.starterCount > 0
      )
      .sort(
        (a, b) =>
          b.starterCount -
            a.starterCount ||
          b.count - a.count
      )
      .slice(0, 8);
  }, [exposureRows, data]);

  /* ============================================================= */
  /* ROOT AGAINST */
  /* ============================================================= */

  const rootAgainst = useMemo(() => {
    if (!data) return [];

    const rows = Object.entries(
      data.against
    ).map(([pid, v]) => {
      const info = lookupPlayer(
        pid,
        data.playersMap
      );

      return {
        pid,
        ...info,
        ...v,
      };
    });

    rows.sort(
      (a, b) =>
        b.starterCount -
          a.starterCount ||
        b.count - a.count
    );

    return rows.slice(0, 8);
  }, [data]);

  /* ============================================================= */
  /* TRACKER DATA */
  /* ============================================================= */

  const trackerRows = useMemo(() => {
    if (!data) return [];

    const search =
      trackerSearch
        .trim()
        .toLowerCase();

    return (
      data.allLeagues || []
    )
      .filter((league) => {
        const type =
          getLeagueType(league);

        const matchesType =
          trackerLeagueTypeFilter ===
            "all" ||
          type ===
            trackerLeagueTypeFilter;

        const matchesSearch =
          !search ||
          (league.name || "")
            .toLowerCase()
            .includes(search);

        return (
          matchesType &&
          matchesSearch
        );
      })
      .sort((a, b) =>
        (a.name || "").localeCompare(
          b.name || ""
        )
      );
  }, [
    data,
    trackerLeagueTypeFilter,
    trackerSearch,
  ]);

  const trackerStats = useMemo(() => {
    const leagues =
      trackerRows || [];

    const tracked = leagues.filter(
      (league) => {
        const value =
          entryFees[
            league.league_id
          ];

        return (
          value !== undefined &&
          value !== "" &&
          Number.isFinite(
            Number(value)
          )
        );
      }
    );

    const total = tracked.reduce(
      (sum, league) =>
        sum +
        Number(
          entryFees[
            league.league_id
          ]
        ),
      0
    );

    return {
      leagues: leagues.length,
      tracked: tracked.length,
      total,
    };
  }, [trackerRows, entryFees]);

  /* ============================================================= */
  /* KPI DATA */
  /* ============================================================= */

  const uniquePlayers = data
    ? Object.keys(data.exposure)
        .length
    : 0;

  const totalSlots = data
    ? Object.values(
        data.exposure
      ).reduce(
        (s, v) => s + v.count,
        0
      )
    : 0;

  const highestExposure =
    exposureRows.length > 0
      ? exposureRows[0]
      : null;

  const averageExposure =
    uniquePlayers > 0 && data
      ? Math.round(
          exposureRows.reduce(
            (sum, r) =>
              sum + r.pct,
            0
          ) / uniquePlayers
        )
      : 0;

  /* ============================================================= */
  /* RENDER */
  /* ============================================================= */

  return (
    <div
      style={{
        background: COLORS.bg,
        color: COLORS.text,
        fontFamily: FONT_BODY,
        minHeight: "100vh",
        width: "100%",
        padding: "0 20px 70px",
        boxSizing: "border-box",
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700;800&family=Inter:wght@400;500;600;700&display=swap');

        * {
          box-sizing: border-box;
        }

        html {
          background: ${COLORS.bg};
        }

        body {
          margin: 0;
          background: ${COLORS.bg};
        }

        input::placeholder {
          color: ${COLORS.textMuted};
        }

        input:focus,
        select:focus {
          outline: none;
          border-color: ${COLORS.turf} !important;
          box-shadow: 0 0 0 3px rgba(101,198,83,0.08);
        }

        button {
          font-family: ${FONT_BODY};
        }

        select {
          appearance: auto;
        }

        .sleeper-row {
          transition:
            background 160ms ease,
            transform 160ms ease;
        }

        .sleeper-row:hover {
          background: ${COLORS.surfaceHover} !important;
        }

        .sort-button {
          transition: all 150ms ease;
        }

        .sort-button:hover {
          border-color: ${COLORS.turf} !important;
          color: ${COLORS.turfBright} !important;
        }

        .run-button {
          transition:
            transform 120ms ease,
            box-shadow 120ms ease,
            background 120ms ease;
        }

        .run-button:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 8px 24px rgba(101,198,83,0.18);
          background: ${COLORS.turfBright} !important;
        }

        .run-button:active:not(:disabled) {
          transform: translateY(0);
        }

        .stat-card {
          transition:
            transform 160ms ease,
            border-color 160ms ease;
        }

        .stat-card:hover {
          transform: translateY(-2px);
          border-color: ${COLORS.lineLight} !important;
        }

        .player-card {
          transition:
            border-color 160ms ease,
            background 160ms ease;
        }

        .player-card:hover {
          border-color: ${COLORS.lineLight} !important;
          background: ${COLORS.surfaceRaised} !important;
        }

        .filter-select {
          transition:
            border-color 150ms ease,
            background 150ms ease;
        }

        .filter-select:hover {
          border-color: ${COLORS.lineLight} !important;
          background: ${COLORS.surfaceRaised} !important;
        }

        .tab-button {
          transition:
            background 150ms ease,
            color 150ms ease,
            border-color 150ms ease;
        }

        .tab-button:hover {
          background: ${COLORS.surfaceRaised} !important;
          color: ${COLORS.text} !important;
        }

        .league-entry {
          transition: background 150ms ease;
        }

        .league-entry:hover {
          background: ${COLORS.surfaceHover} !important;
        }

        .league-entry:focus-visible {
          outline: 2px solid ${COLORS.turf};
          outline-offset: 1px;
        }

        .tracker-row {
          transition:
            background 150ms ease,
            border-color 150ms ease;
        }

        .tracker-row:hover {
          background: ${COLORS.surfaceHover} !important;
        }

        .tracker-fee-input {
          transition:
            border-color 150ms ease,
            background 150ms ease;
        }

        .tracker-fee-input:hover {
          border-color: ${COLORS.lineLight} !important;
          background: ${COLORS.surfaceHover} !important;
        }

        .tracker-fee-input:focus {
          outline: none;
          border-color: ${COLORS.turf} !important;
          box-shadow: 0 0 0 3px rgba(101,198,83,0.08);
        }

        .pulse {
          animation: pulse 1.8s ease-in-out infinite;
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }

          50% {
            opacity: .45;
          }
        }

        @keyframes spin {
          from {
            transform: rotate(0deg);
          }

          to {
            transform: rotate(360deg);
          }
        }

        ::-webkit-scrollbar {
          height: 8px;
          width: 8px;
        }

        ::-webkit-scrollbar-track {
          background: ${COLORS.bg};
        }

        ::-webkit-scrollbar-thumb {
          background: ${COLORS.line};
          border-radius: 4px;
        }

        @media (max-width: 700px) {
          .hero-title {
            font-size: 38px !important;
          }

          .desktop-only {
            display: none !important;
          }

          .player-meta {
            display: none !important;
          }
        }
      `}</style>

      <div
        style={{
          maxWidth: 1080,
          margin: "0 auto",
        }}
      >
        {/* ========================================================= */}
        {/* HERO */}
        {/* ========================================================= */}

        <div
          style={{
            paddingTop: 38,
            paddingBottom: 28,
            borderBottom: `1px solid ${COLORS.line}`,
            marginBottom: 24,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 12,
              color: COLORS.turf,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
            }}
          >
            <CircleDot size={13} />
            Sleeper roster intelligence
          </div>

          <div
            className="hero-title"
            style={{
              fontFamily: FONT_HEAD,
              fontWeight: 800,
              fontSize: 52,
              letterSpacing: "-0.015em",
              lineHeight: 0.98,
              color: COLORS.text,
              maxWidth: 760,
            }}
          >
            Where's my roster
            <span
              style={{
                color: COLORS.turf,
              }}
            >
              {" "}
              spread thin?
            </span>
          </div>

          <div
            style={{
              color: COLORS.textDim,
              fontSize: 15,
              lineHeight: 1.6,
              marginTop: 13,
              maxWidth: 650,
            }}
          >
            See which players you're exposed to
            across every Sleeper league, who's
            moving your week, and which opposing
            players you should be rooting against.
          </div>

          {status === "done" &&
            data && (
              <div
                style={{
                  display:
                    "inline-flex",
                  alignItems:
                    "center",
                  gap: 8,
                  marginTop: 18,
                  padding:
                    "7px 11px",
                  borderRadius: 999,
                  background:
                    "rgba(101,198,83,0.08)",
                  border:
                    "1px solid rgba(101,198,83,0.22)",
                  color:
                    COLORS.turfBright,
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius:
                      "50%",
                    background:
                      COLORS.turf,
                    boxShadow: `0 0 10px ${COLORS.turf}`,
                  }}
                />

                {data.user
                  .display_name ||
                  data.user.username}{" "}
                · {data.season} season ·
                Week {data.week}
              </div>
            )}
        </div>

        {/* ========================================================= */}
        {/* SEARCH / CONTROLS */}
        {/* ========================================================= */}

        <form
          onSubmit={runAnalysis}
          style={{
            background:
              COLORS.surface,
            border: `1px solid ${COLORS.line}`,
            borderRadius: 14,
            padding: 18,
            marginBottom: 24,
            boxShadow:
              "0 12px 40px rgba(0,0,0,0.18)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems:
                "center",
              justifyContent:
                "space-between",
              marginBottom: 14,
              gap: 10,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color:
                    COLORS.text,
                }}
              >
                Analyze your leagues
              </div>

              <div
                style={{
                  fontSize: 11,
                  color:
                    COLORS.textMuted,
                  marginTop: 3,
                }}
              >
                Pull live roster and
                matchup data from Sleeper
              </div>
            </div>

            <div
              style={{
                display: "flex",
                alignItems:
                  "center",
                gap: 6,
                fontSize: 10,
                color:
                  COLORS.textMuted,
                textTransform:
                  "uppercase",
                letterSpacing:
                  "0.08em",
                fontWeight: 700,
              }}
            >
              <span
                style={{
                  width: 6,
                  height: 6,
                  borderRadius:
                    "50%",
                  background:
                    COLORS.turf,
                }}
              />
              Live API
            </div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "minmax(220px, 1fr) 110px 100px auto",
              gap: 10,
              alignItems: "end",
            }}
            className="control-grid"
          >
            {/* Username */}

            <div>
              <label
                style={{
                  fontSize: 10,
                  color:
                    COLORS.textDim,
                  display:
                    "block",
                  marginBottom: 6,
                  fontWeight: 700,
                  textTransform:
                    "uppercase",
                  letterSpacing:
                    "0.08em",
                }}
              >
                Sleeper username
              </label>

              <div
                style={{
                  position:
                    "relative",
                }}
              >
                <Search
                  size={16}
                  color={
                    COLORS.textMuted
                  }
                  style={{
                    position:
                      "absolute",
                    left: 12,
                    top: 11,
                  }}
                />

                <input
                  value={username}
                  onChange={(e) =>
                    setUsername(
                      e.target.value
                    )
                  }
                  placeholder="e.g. sleeperuser"
                  style={{
                    width: "100%",
                    height: 40,
                    background:
                      COLORS.surfaceRaised,
                    border: `1px solid ${COLORS.line}`,
                    borderRadius: 8,
                    padding:
                      "9px 12px 9px 36px",
                    color:
                      COLORS.text,
                    fontSize: 13,
                  }}
                />
              </div>
            </div>

            {/* Season */}

            <div>
              <label
                style={{
                  fontSize: 10,
                  color:
                    COLORS.textDim,
                  display:
                    "block",
                  marginBottom: 6,
                  fontWeight: 700,
                  textTransform:
                    "uppercase",
                  letterSpacing:
                    "0.08em",
                }}
              >
                Season
              </label>

              <input
                value={season}
                onChange={(e) =>
                  setSeason(
                    e.target.value.replace(
                      /[^0-9]/g,
                      ""
                    )
                  )
                }
                style={{
                  width: "100%",
                  height: 40,
                  background:
                    COLORS.surfaceRaised,
                  border: `1px solid ${COLORS.line}`,
                  borderRadius: 8,
                  padding:
                    "9px 11px",
                  color:
                    COLORS.text,
                  fontSize: 13,
                }}
              />
            </div>

            {/* Week */}

            <div>
              <label
                style={{
                  fontSize: 10,
                  color:
                    COLORS.textDim,
                  display:
                    "block",
                  marginBottom: 6,
                  fontWeight: 700,
                  textTransform:
                    "uppercase",
                  letterSpacing:
                    "0.08em",
                }}
              >
                Week
              </label>

              <input
                value={week}
                onChange={(e) =>
                  setWeek(
                    e.target.value.replace(
                      /[^0-9]/g,
                      ""
                    )
                  )
                }
                style={{
                  width: "100%",
                  height: 40,
                  background:
                    COLORS.surfaceRaised,
                  border: `1px solid ${COLORS.line}`,
                  borderRadius: 8,
                  padding:
                    "9px 11px",
                  color:
                    COLORS.text,
                  fontSize: 13,
                }}
              />
            </div>

            {/* Run */}

            <button
              className="run-button"
              type="submit"
              disabled={!canSubmit}
              style={{
                background:
                  canSubmit
                    ? COLORS.turf
                    : COLORS.line,
                color:
                  canSubmit
                    ? COLORS.bg
                    : COLORS.textMuted,
                border: "none",
                borderRadius: 8,
                padding:
                  "0 20px",
                fontWeight: 800,
                fontSize: 13,
                cursor:
                  canSubmit
                    ? "pointer"
                    : "not-allowed",
                display: "flex",
                alignItems:
                  "center",
                justifyContent:
                  "center",
                gap: 8,
                height: 40,
                whiteSpace:
                  "nowrap",
              }}
            >
              {status ===
              "loading" ? (
                <Loader2
                  size={16}
                  style={{
                    animation:
                      "spin 1s linear infinite",
                  }}
                />
              ) : (
                <Zap size={16} />
              )}

              {status ===
              "loading"
                ? "Analyzing…"
                : "Check exposure"}
            </button>
          </div>
        </form>

        {/* ========================================================= */}
        {/* LOADING */}
        {/* ========================================================= */}

        {status ===
          "loading" && (
          <div
            style={{
              background:
                "rgba(101,198,83,0.055)",
              border:
                "1px solid rgba(101,198,83,0.15)",
              borderRadius: 12,
              padding:
                "13px 15px",
              marginBottom: 22,
              display: "flex",
              alignItems:
                "center",
              gap: 10,
              color:
                COLORS.textDim,
              fontSize: 13,
            }}
          >
            <Loader2
              size={16}
              color={
                COLORS.turf
              }
              style={{
                animation:
                  "spin 1s linear infinite",
                flexShrink: 0,
              }}
            />

            <span>
              {statusMsg}
            </span>
          </div>
        )}

        {/* ========================================================= */}
        {/* ERROR */}
        {/* ========================================================= */}

        {status ===
          "error" && (
          <div
            style={{
              background:
                "rgba(239,112,72,0.08)",
              border:
                "1px solid rgba(239,112,72,0.35)",
              color:
                COLORS.rivalBright,
              borderRadius: 12,
              padding:
                "14px 16px",
              fontSize: 13,
              marginBottom: 22,
              display: "flex",
              gap: 11,
              alignItems:
                "flex-start",
            }}
          >
            <AlertCircle
              size={17}
              style={{
                flexShrink: 0,
                marginTop: 1,
              }}
            />

            <span>
              {statusMsg}
            </span>
          </div>
        )}

        {/* ========================================================= */}
        {/* TABS + DASHBOARD */}
        {/* ========================================================= */}

        {status ===
          "done" &&
          data && (
            <>
              {/* =================================================== */}
              {/* TAB NAVIGATION */}
              {/* =================================================== */}

              <div
                style={{
                  display: "flex",
                  gap: 5,
                  background:
                    COLORS.surface,
                  border: `1px solid ${COLORS.line}`,
                  borderRadius: 12,
                  padding: 5,
                  marginBottom: 24,
                }}
              >
                <button
                  className="tab-button"
                  type="button"
                  onClick={() =>
                    setActiveTab(
                      "exposure"
                    )
                  }
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems:
                      "center",
                    justifyContent:
                      "center",
                    gap: 8,
                    height: 40,
                    borderRadius: 8,
                    border:
                      activeTab ===
                      "exposure"
                        ? `1px solid ${COLORS.turf}`
                        : "1px solid transparent",
                    background:
                      activeTab ===
                      "exposure"
                        ? "rgba(101,198,83,0.12)"
                        : "transparent",
                    color:
                      activeTab ===
                      "exposure"
                        ? COLORS.turfBright
                        : COLORS.textDim,
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  <BarChart3
                    size={16}
                  />
                  Exposure Dashboard
                </button>

                <button
                  className="tab-button"
                  type="button"
                  onClick={() =>
                    setActiveTab(
                      "tracker"
                    )
                  }
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems:
                      "center",
                    justifyContent:
                      "center",
                    gap: 8,
                    height: 40,
                    borderRadius: 8,
                    border:
                      activeTab ===
                      "tracker"
                        ? `1px solid ${COLORS.turf}`
                        : "1px solid transparent",
                    background:
                      activeTab ===
                      "tracker"
                        ? "rgba(101,198,83,0.12)"
                        : "transparent",
                    color:
                      activeTab ===
                      "tracker"
                        ? COLORS.turfBright
                        : COLORS.textDim,
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: "pointer",
                  }}
                >
                  <DollarSign
                    size={16}
                  />
                  League Tracker
                </button>
              </div>

              {/* =================================================== */}
              {/* EXPOSURE TAB */}
              {/* =================================================== */}

              {activeTab ===
                "exposure" && (
                <>
                  {/* =============================================== */}
                  {/* KPI CARDS */}
                  {/* =============================================== */}

                  <div
                    className="stat-grid"
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(4, minmax(0, 1fr))",
                      gap: 10,
                      marginBottom: 30,
                    }}
                  >
                    <StatCard
                      icon={Layers}
                      label="Leagues"
                      value={
                        data.totalLeagues
                      }
                      accent={
                        COLORS.turf
                      }
                    />

                    <StatCard
                      icon={Users}
                      label="Unique players"
                      value={
                        uniquePlayers
                      }
                      accent={
                        COLORS.blue
                      }
                    />

                    <StatCard
                      icon={
                        BarChart3
                      }
                      label="Avg. exposure"
                      value={`${averageExposure}%`}
                      accent={
                        COLORS.yellow
                      }
                    />

                    <StatCard
                      icon={Target}
                      label="Roster slots"
                      value={
                        totalSlots
                      }
                      accent={
                        COLORS.purple
                      }
                    />
                  </div>

                  {/* =============================================== */}
                  {/* BIGGEST EXPOSURE */}
                  {/* =============================================== */}

                  {highestExposure && (
                    <div
                      style={{
                        background:
                          "linear-gradient(135deg, rgba(101,198,83,0.10), rgba(17,26,21,0.8))",
                        border:
                          "1px solid rgba(101,198,83,0.20)",
                        borderRadius: 14,
                        padding:
                          "16px 18px",
                        marginBottom: 30,
                        display: "flex",
                        alignItems:
                          "center",
                        gap: 15,
                        flexWrap:
                          "wrap",
                      }}
                    >
                      <div
                        style={{
                          width: 42,
                          height: 42,
                          borderRadius: 11,
                          background:
                            "rgba(101,198,83,0.12)",
                          display:
                            "flex",
                          alignItems:
                            "center",
                          justifyContent:
                            "center",
                          color:
                            COLORS.turf,
                          flexShrink: 0,
                        }}
                      >
                        <TrendingUp
                          size={21}
                        />
                      </div>

                      <div
                        style={{
                          flex: 1,
                          minWidth: 180,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 10,
                            color:
                              COLORS.turf,
                            fontWeight: 800,
                            textTransform:
                              "uppercase",
                            letterSpacing:
                              "0.1em",
                            marginBottom: 3,
                          }}
                        >
                          Your highest
                          exposure
                        </div>

                        <div
                          style={{
                            fontFamily:
                              FONT_HEAD,
                            fontSize: 24,
                            fontWeight: 700,
                          }}
                        >
                          {
                            highestExposure.name
                          }

                          <span
                            style={{
                              color:
                                COLORS.textDim,
                              fontSize: 15,
                              marginLeft: 7,
                              fontFamily:
                                FONT_BODY,
                              fontWeight: 500,
                            }}
                          >
                            {
                              highestExposure.position
                            }{" "}
                            ·{" "}
                            {
                              highestExposure.team
                            }
                          </span>
                        </div>
                      </div>

                      <div
                        style={{
                          textAlign:
                            "right",
                        }}
                      >
                        <div
                          style={{
                            fontFamily:
                              FONT_HEAD,
                            fontWeight: 800,
                            fontSize: 30,
                            lineHeight: 1,
                            color:
                              highestExposure.pct >=
                              75
                                ? COLORS.rivalBright
                                : COLORS.turfBright,
                          }}
                        >
                          {
                            highestExposure.pct
                          }
                          %
                        </div>

                        <div
                          style={{
                            color:
                              COLORS.textMuted,
                            fontSize: 10,
                            textTransform:
                              "uppercase",
                            letterSpacing:
                              "0.07em",
                            marginTop: 3,
                          }}
                        >
                          roster exposure
                        </div>
                      </div>
                    </div>
                  )}

                  {/* =============================================== */}
                  {/* ROOT FOR / AGAINST */}
                  {/* =============================================== */}

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(2, minmax(0, 1fr))",
                      gap: 14,
                      marginBottom: 34,
                    }}
                    className="root-grid"
                  >
                    <ExposurePanel
                      title="Root for"
                      subtitle={`Week ${data.week} · your biggest starting exposure`}
                      description="These players are starting across the most of your leagues."
                      icon={Flame}
                      color={
                        COLORS.turf
                      }
                      rows={rootFor}
                      total={
                        data.totalLeagues
                      }
                      emptyText="No starters found for this week — double check the week number."
                    />

                    <ExposurePanel
                      title="Root against"
                      subtitle={`Week ${data.week} · opposing starters`}
                      description="These players are starting against you and can swing multiple matchups."
                      icon={
                        ShieldAlert
                      }
                      color={
                        COLORS.rival
                      }
                      rows={
                        rootAgainst
                      }
                      total={
                        data.totalLeagues
                      }
                      emptyText="No opposing starters found — matchups may not be set for this week yet."
                    />
                  </div>

                  {/* =============================================== */}
                  {/* FULL ROSTER EXPOSURE HEADER */}
                  {/* =============================================== */}

                  <div
                    style={{
                      display: "flex",
                      alignItems:
                        "flex-end",
                      justifyContent:
                        "space-between",
                      gap: 15,
                      marginBottom: 12,
                      flexWrap:
                        "wrap",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          display:
                            "flex",
                          alignItems:
                            "center",
                          gap: 9,
                        }}
                      >
                        <div
                          style={{
                            width: 4,
                            height: 23,
                            background:
                              COLORS.turf,
                            borderRadius: 4,
                          }}
                        />

                        <div
                          style={{
                            fontFamily:
                              FONT_HEAD,
                            fontSize: 27,
                            fontWeight: 700,
                          }}
                        >
                          Full roster
                          exposure
                        </div>
                      </div>

                      <div
                        style={{
                          color:
                            COLORS.textMuted,
                          fontSize: 12,
                          marginTop: 4,
                          marginLeft: 13,
                        }}
                      >
                        Every player across
                        your{" "}
                        {
                          data.totalLeagues
                        }{" "}
                        league
                        {data.totalLeagues ===
                        1
                          ? ""
                          : "s"}
                      </div>
                    </div>

                    {/* ============================================= */}
                    {/* FILTERS + SORT */}
                    {/* ============================================= */}

                    <div
                      style={{
                        display:
                          "flex",
                        gap: 7,
                        flexWrap:
                          "wrap",
                        alignItems:
                          "center",
                        justifyContent:
                          "flex-end",
                      }}
                    >
                      {/* League Type */}

                      <select
                        className="filter-select"
                        value={
                          leagueTypeFilter
                        }
                        onChange={(e) =>
                          setLeagueTypeFilter(
                            e.target.value
                          )
                        }
                        aria-label="Filter by league type"
                        style={{
                          height: 32,
                          background:
                            COLORS.surface,
                          color:
                            COLORS.text,
                          border: `1px solid ${COLORS.line}`,
                          borderRadius: 7,
                          padding:
                            "0 9px",
                          fontSize: 11,
                          fontWeight: 700,
                          cursor:
                            "pointer",
                        }}
                      >
                        <option value="all">
                          All league types
                        </option>

                        <option value="Best Ball">
                          Best Ball
                        </option>

                        <option value="Redraft">
                          Redraft
                        </option>

                        <option value="Dynasty">
                          Dynasty
                        </option>

                        <option value="Keeper">
                          Keeper
                        </option>

                        <option value="Other">
                          Other
                        </option>
                      </select>

                      {/* Position */}

                      <select
                        className="filter-select"
                        value={
                          positionFilter
                        }
                        onChange={(e) =>
                          setPositionFilter(
                            e.target.value
                          )
                        }
                        aria-label="Filter by position"
                        style={{
                          height: 32,
                          background:
                            COLORS.surface,
                          color:
                            COLORS.text,
                          border: `1px solid ${COLORS.line}`,
                          borderRadius: 7,
                          padding:
                            "0 9px",
                          fontSize: 11,
                          fontWeight: 700,
                          cursor:
                            "pointer",
                        }}
                      >
                        <option value="all">
                          All positions
                        </option>

                        <option value="QB">
                          QB
                        </option>

                        <option value="RB">
                          RB
                        </option>

                        <option value="WR">
                          WR
                        </option>

                        <option value="TE">
                          TE
                        </option>

                        <option value="K">
                          K
                        </option>

                        <option value="DEF">
                          DEF
                        </option>
                      </select>

                      {/* Sort */}

                      <div
                        style={{
                          display:
                            "flex",
                          gap: 5,
                        }}
                      >
                        {[
                          {
                            key: "count",
                            label: "Rostered",
                          },
                          {
                            key: "starters",
                            label: "Starting",
                          },
                          {
                            key: "name",
                            label: "Name",
                          },
                        ].map((s) => (
                          <button
                            className="sort-button"
                            key={s.key}
                            type="button"
                            onClick={() =>
                              setSortKey(
                                s.key
                              )
                            }
                            style={{
                              background:
                                sortKey ===
                                s.key
                                  ? COLORS.turf
                                  : "transparent",
                              color:
                                sortKey ===
                                s.key
                                  ? COLORS.bg
                                  : COLORS.textDim,
                              border: `1px solid ${
                                sortKey ===
                                s.key
                                  ? COLORS.turf
                                  : COLORS.line
                              }`,
                              borderRadius: 7,
                              padding:
                                "6px 10px",
                              fontSize: 11,
                              cursor:
                                "pointer",
                              fontWeight: 700,
                            }}
                          >
                            {
                              s.label
                            }
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* =============================================== */}
                  {/* ACTIVE FILTER SUMMARY */}
                  {/* =============================================== */}

                  {(leagueTypeFilter !==
                    "all" ||
                    positionFilter !==
                      "all") && (
                    <div
                      style={{
                        display:
                          "flex",
                        alignItems:
                          "center",
                        gap: 8,
                        marginBottom: 12,
                        padding:
                          "8px 11px",
                        background:
                          "rgba(101,198,83,0.055)",
                        border:
                          "1px solid rgba(101,198,83,0.14)",
                        borderRadius: 8,
                        color:
                          COLORS.textDim,
                        fontSize: 11,
                      }}
                    >
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius:
                            "50%",
                          background:
                            COLORS.turf,
                          flexShrink: 0,
                        }}
                      />

                      <span>
                        Showing{" "}
                        <strong
                          style={{
                            color:
                              COLORS.text,
                          }}
                        >
                          {
                            filteredExposureRows.length
                          }
                        </strong>{" "}
                        player
                        {filteredExposureRows.length ===
                        1
                          ? ""
                          : "s"}

                        {leagueTypeFilter !==
                          "all" &&
                          ` · ${leagueTypeFilter}`}

                        {positionFilter !==
                          "all" &&
                          ` · ${positionFilter}`}
                      </span>

                      <button
                        type="button"
                        onClick={() => {
                          setLeagueTypeFilter(
                            "all"
                          );
                          setPositionFilter(
                            "all"
                          );
                        }}
                        style={{
                          marginLeft:
                            "auto",
                          background:
                            "transparent",
                          border:
                            "none",
                          color:
                            COLORS.turf,
                          fontSize: 10,
                          fontWeight: 700,
                          cursor:
                            "pointer",
                          padding:
                            "2px 4px",
                        }}
                      >
                        Clear filters
                      </button>
                    </div>
                  )}

                  {/* =============================================== */}
                  {/* PLAYER TABLE */}
                  {/* =============================================== */}

                  <div
                    style={{
                      border: `1px solid ${COLORS.line}`,
                      borderRadius: 14,
                      overflow:
                        "hidden",
                      background:
                        COLORS.surface,
                    }}
                  >
                    {/* Table header */}

                    <div
                      className="desktop-only"
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "70px minmax(180px,1fr) 125px 190px 65px 25px",
                        gap: 12,
                        alignItems:
                          "center",
                        padding:
                          "10px 16px",
                        background:
                          "rgba(255,255,255,0.015)",
                        borderBottom:
                          `1px solid ${COLORS.line}`,
                        color:
                          COLORS.textMuted,
                        fontSize: 9,
                        fontWeight: 800,
                        textTransform:
                          "uppercase",
                        letterSpacing:
                          "0.1em",
                      }}
                    >
                      <div>Pos</div>
                      <div>Player</div>
                      <div>Starting</div>
                      <div>Exposure</div>
                      <div
                        style={{
                          textAlign:
                            "right",
                        }}
                      >
                        %
                      </div>
                      <div />
                    </div>

                    {/* Player rows */}

                    {filteredExposureRows.map(
                      (r, i) => {
                        const level =
                          exposureLevel(
                            r.pct
                          );

                        return (
                          <div
                            key={r.pid}
                          >
                            {/* Main row */}

                            <div
                              className="sleeper-row"
                              onClick={() =>
                                setExpanded(
                                  expanded ===
                                    r.pid
                                    ? null
                                    : r.pid
                                )
                              }
                              style={{
                                display:
                                  "grid",
                                gridTemplateColumns:
                                  "70px minmax(180px,1fr) 125px 190px 65px 25px",
                                gap: 12,
                                alignItems:
                                  "center",
                                padding:
                                  "13px 16px",
                                background:
                                  i %
                                    2 ===
                                  0
                                    ? COLORS.surface
                                    : COLORS.bg,
                                borderTop:
                                  i === 0
                                    ? "none"
                                    : `1px solid ${COLORS.line}`,
                                cursor:
                                  "pointer",
                              }}
                            >
                              {/* Position */}

                              <div
                                style={{
                                  display:
                                    "flex",
                                  alignItems:
                                    "center",
                                  gap: 7,
                                }}
                              >
                                <div
                                  style={{
                                    width: 4,
                                    height: 26,
                                    borderRadius: 3,
                                    background:
                                      positionColor(
                                        r.position
                                      ),
                                  }}
                                />

                                <span
                                  style={{
                                    fontSize: 10,
                                    fontWeight: 800,
                                    color:
                                      positionColor(
                                        r.position
                                      ),
                                  }}
                                >
                                  {
                                    r.position
                                  }
                                </span>
                              </div>

                              {/* Player */}

                              <div
                                style={{
                                  minWidth: 0,
                                }}
                              >
                                <div
                                  style={{
                                    display:
                                      "flex",
                                    alignItems:
                                      "center",
                                    gap: 7,
                                    minWidth: 0,
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: 13,
                                      fontWeight: 700,
                                      overflow:
                                        "hidden",
                                      textOverflow:
                                        "ellipsis",
                                      whiteSpace:
                                        "nowrap",
                                    }}
                                  >
                                    {
                                      r.name
                                    }
                                  </span>

                                  <span
                                    className="player-meta"
                                    style={{
                                      color:
                                        COLORS.textMuted,
                                      fontSize: 11,
                                      whiteSpace:
                                        "nowrap",
                                    }}
                                  >
                                    {
                                      r.team
                                    }
                                  </span>
                                </div>

                                <div
                                  style={{
                                    display:
                                      "flex",
                                    alignItems:
                                      "center",
                                    gap: 6,
                                    marginTop: 4,
                                  }}
                                >
                                  <span
                                    style={{
                                      padding:
                                        "2px 5px",
                                      borderRadius: 4,
                                      background:
                                        level.background,
                                      color:
                                        level.color,
                                      fontSize: 8,
                                      fontWeight: 800,
                                      letterSpacing:
                                        "0.05em",
                                    }}
                                  >
                                    {
                                      level.label
                                    }
                                  </span>

                                  <span
                                    style={{
                                      color:
                                        COLORS.textMuted,
                                      fontSize: 9,
                                    }}
                                  >
                                    {
                                      r.count
                                    }{" "}
                                    league
                                    {r.count ===
                                    1
                                      ? ""
                                      : "s"}
                                  </span>
                                </div>
                              </div>

                              {/* Starting */}

                              <div
                                style={{
                                  fontSize: 11,
                                  color:
                                    COLORS.textDim,
                                }}
                              >
                                <strong
                                  style={{
                                    color:
                                      COLORS.text,
                                  }}
                                >
                                  {
                                    r.starterCount
                                  }
                                </strong>

                                {" / "}

                                {
                                  r.count
                                }

                                <span
                                  style={{
                                    color:
                                      COLORS.textMuted,
                                    marginLeft: 5,
                                  }}
                                >
                                  starting
                                </span>
                              </div>

                              {/* Exposure bar */}

                              <div>
                                <div
                                  style={{
                                    height: 7,
                                    width: "100%",
                                    background:
                                      COLORS.line,
                                    borderRadius: 99,
                                    overflow:
                                      "hidden",
                                  }}
                                >
                                  <div
                                    style={{
                                      height:
                                        "100%",
                                      width: `${Math.min(
                                        r.pct,
                                        100
                                      )}%`,
                                      background:
                                        level.color,
                                      borderRadius: 99,
                                      transition:
                                        "width 300ms ease",
                                    }}
                                  />
                                </div>
                              </div>

                              {/* Percentage */}

                              <div
                                style={{
                                  fontFamily:
                                    FONT_HEAD,
                                  fontSize: 21,
                                  fontWeight: 800,
                                  textAlign:
                                    "right",
                                  color:
                                    level.color,
                                }}
                              >
                                {r.pct}%
                              </div>

                              {/* Chevron */}

                              <div
                                style={{
                                  display:
                                    "flex",
                                  justifyContent:
                                    "flex-end",
                                }}
                              >
                                {expanded ===
                                r.pid ? (
                                  <ChevronUp
                                    size={15}
                                    color={
                                      COLORS.textDim
                                    }
                                  />
                                ) : (
                                  <ChevronDown
                                    size={15}
                                    color={
                                      COLORS.textDim
                                    }
                                  />
                                )}
                              </div>
                            </div>

                            {/* Expanded league breakdown */}

                            {expanded ===
                              r.pid && (
                              <div
                                style={{
                                  padding:
                                    "14px 18px 17px 88px",
                                  background:
                                    COLORS.bg,
                                  borderTop:
                                    `1px solid ${COLORS.line}`,
                                }}
                              >
                                <div
                                  style={{
                                    color:
                                      COLORS.textMuted,
                                    fontSize: 9,
                                    fontWeight: 800,
                                    textTransform:
                                      "uppercase",
                                    letterSpacing:
                                      "0.09em",
                                    marginBottom: 8,
                                  }}
                                >
                                  League
                                  breakdown
                                </div>

                                <div
                                  style={{
                                    display:
                                      "grid",
                                    gap: 3,
                                  }}
                                >
                                  {r.entries.map(
                                    (
                                      entry,
                                      idx
                                    ) => {
                                      const leagueKey = `${r.pid}:${entry.leagueId}`;
                                      const leagueOpen =
                                        expandedLeague ===
                                        leagueKey;
                                      const leagueBundle =
                                        ownedByLeagueId[
                                          entry.leagueId
                                        ];

                                      return (
                                      <div
                                        key={`${entry.leagueId}-${idx}`}
                                      >
                                      <div
                                        className="league-entry"
                                        role="button"
                                        tabIndex={0}
                                        aria-expanded={
                                          leagueOpen
                                        }
                                        onClick={() =>
                                          setExpandedLeague(
                                            leagueOpen
                                              ? null
                                              : leagueKey
                                          )
                                        }
                                        onKeyDown={(e) => {
                                          if (
                                            e.key ===
                                              "Enter" ||
                                            e.key === " "
                                          ) {
                                            e.preventDefault();
                                            setExpandedLeague(
                                              leagueOpen
                                                ? null
                                                : leagueKey
                                            );
                                          }
                                        }}
                                        style={{
                                          display:
                                            "flex",
                                          alignItems:
                                            "center",
                                          gap: 9,
                                          minHeight:
                                            30,
                                          padding:
                                            "2px 8px",
                                          marginLeft: -8,
                                          borderRadius: 6,
                                          cursor:
                                            "pointer",
                                          background:
                                            leagueOpen
                                              ? COLORS.surfaceRaised
                                              : "transparent",
                                          fontSize: 11,
                                          color:
                                            COLORS.textDim,
                                        }}
                                      >
                                        <span
                                          style={{
                                            width: 6,
                                            height: 6,
                                            borderRadius:
                                              "50%",
                                            background:
                                              entry.starter
                                                ? COLORS.turf
                                                : COLORS.lineLight,
                                            flexShrink: 0,
                                          }}
                                        />

                                        <span
                                          style={{
                                            flex: 1,
                                          }}
                                        >
                                          {
                                            entry.leagueName
                                          }

                                          {entry.teamName
                                            ? ` — ${entry.teamName}`
                                            : ""}
                                        </span>

                                        <span
                                          style={{
                                            color:
                                              COLORS.textMuted,
                                            fontSize: 8,
                                            fontWeight: 800,
                                            letterSpacing:
                                              "0.05em",
                                            marginRight: 5,
                                          }}
                                        >
                                          {
                                            entry.leagueType
                                          }
                                        </span>

                                        {entry.starter ? (
                                          <span
                                            style={{
                                              color:
                                                COLORS.turf,
                                              fontSize: 8,
                                              fontWeight: 800,
                                              letterSpacing:
                                                "0.06em",
                                            }}
                                          >
                                            STARTING
                                          </span>
                                        ) : (
                                          <span
                                            style={{
                                              color:
                                                COLORS.textMuted,
                                              fontSize: 9,
                                            }}
                                          >
                                            BENCH
                                          </span>
                                        )}

                                        {leagueOpen ? (
                                          <ChevronUp
                                            size={13}
                                            color={
                                              COLORS.textDim
                                            }
                                          />
                                        ) : (
                                          <ChevronDown
                                            size={13}
                                            color={
                                              COLORS.textDim
                                            }
                                          />
                                        )}
                                      </div>

                                      {leagueOpen &&
                                        leagueBundle && (
                                          <LeagueStandingsTable
                                            bundle={
                                              leagueBundle
                                            }
                                          />
                                        )}
                                      </div>
                                      );
                                    }
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      }
                    )}

                    {/* Empty / filtered state */}

                    {filteredExposureRows.length ===
                      0 && (
                      <div
                        style={{
                          padding: 35,
                          textAlign:
                            "center",
                          color:
                            COLORS.textMuted,
                          fontSize: 13,
                        }}
                      >
                        {exposureRows.length ===
                        0
                          ? "No rostered players found."
                          : "No players match the selected filters."}
                      </div>
                    )}
                  </div>

                  {/* =============================================== */}
                  {/* FOOTER */}
                  {/* =============================================== */}

                  <div
                    style={{
                      display:
                        "flex",
                      alignItems:
                        "center",
                      justifyContent:
                        "center",
                      gap: 7,
                      color:
                        COLORS.textMuted,
                      fontSize: 10,
                      marginTop: 18,
                    }}
                  >
                    <Trophy
                      size={12}
                    />

                    Data pulled directly
                    from Sleeper · Week{" "}
                    {data.week} ·{" "}
                    {data.season}
                  </div>
                </>
              )}

              {/* =================================================== */}
              {/* LEAGUE TRACKER TAB */}
              {/* =================================================== */}

              {activeTab ===
                "tracker" && (
                <LeagueTracker
                  data={data}
                  entryFees={
                    entryFees
                  }
                  onEntryFeeChange={
                    handleEntryFeeChange
                  }
                  trackerLeagueTypeFilter={
                    trackerLeagueTypeFilter
                  }
                  setTrackerLeagueTypeFilter={
                    setTrackerLeagueTypeFilter
                  }
                  trackerSearch={
                    trackerSearch
                  }
                  setTrackerSearch={
                    setTrackerSearch
                  }
                  trackerRows={
                    trackerRows
                  }
                  trackerStats={
                    trackerStats
                  }
                />
              )}
            </>
          )}

        {/* ========================================================= */}
        {/* EMPTY STATE */}
        {/* ========================================================= */}

        {status ===
          "idle" && (
          <div
            style={{
              border:
                `1px dashed ${COLORS.line}`,
              borderRadius: 14,
              padding:
                "50px 25px",
              textAlign:
                "center",
              marginTop: 15,
              background:
                "rgba(255,255,255,0.008)",
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                margin:
                  "0 auto 15px",
                borderRadius: 14,
                background:
                  "rgba(101,198,83,0.08)",
                display:
                  "flex",
                alignItems:
                  "center",
                justifyContent:
                  "center",
                color:
                  COLORS.turf,
              }}
            >
              <BarChart3
                size={24}
              />
            </div>

            <div
              style={{
                fontFamily:
                  FONT_HEAD,
                fontSize: 25,
                fontWeight: 700,
              }}
            >
              Your roster
              intelligence
              starts here
            </div>

            <div
              style={{
                color:
                  COLORS.textMuted,
                fontSize: 12,
                marginTop: 6,
              }}
            >
              Enter your Sleeper
              username above to
              analyze your league
              exposure.
            </div>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* RESPONSIVE */}
      {/* ========================================================= */}

      <style>{`
        @media (max-width: 850px) {
          .control-grid {
            grid-template-columns: 1fr 1fr !important;
          }

          .control-grid > div:first-child {
            grid-column: 1 / -1;
          }

          .control-grid button {
            grid-column: 1 / -1;
          }

          .root-grid {
            grid-template-columns: 1fr !important;
          }

          .tracker-header-grid {
            grid-template-columns:
              minmax(180px, 1fr)
              100px
              100px
              120px !important;
          }

          .tracker-row-grid {
            grid-template-columns:
              minmax(180px, 1fr)
              100px
              100px
              120px !important;
          }
        }

        @media (max-width: 700px) {
          .control-grid {
            grid-template-columns: 1fr !important;
          }

          .control-grid > div:first-child {
            grid-column: auto;
          }

          .control-grid button {
            grid-column: auto;
          }

          .desktop-only {
            display: none !important;
          }

          .sleeper-row {
            grid-template-columns:
              45px minmax(0, 1fr)
              55px 25px !important;
            gap: 8px !important;
            padding: 12px !important;
          }

          .sleeper-row > div:nth-child(3),
          .sleeper-row > div:nth-child(4) {
            display: none !important;
          }

          .sleeper-row > div:nth-child(5) {
            grid-column: 3;
          }

          .sleeper-row > div:nth-child(6) {
            grid-column: 4;
          }

          .sleeper-row > div:nth-child(2) {
            grid-column: 2;
          }

          .sleeper-row > div:nth-child(1) {
            grid-column: 1;
          }

          .stat-grid {
            grid-template-columns:
              1fr 1fr !important;
          }

          .tab-button {
            font-size: 11px !important;
          }

          .tracker-header-grid {
            display: none !important;
          }

          .tracker-row-grid {
            grid-template-columns:
              minmax(0, 1fr) 105px !important;
            gap: 10px !important;
          }

          .tracker-team-count {
            display: none !important;
          }

          .tracker-type {
            display: none !important;
          }

          .tracker-league-info {
            min-width: 0;
          }
        }

        @media (max-width: 520px) {
          .root-grid {
            grid-template-columns: 1fr !important;
          }

          .filter-select {
            flex: 1;
            min-width: 130px;
          }

          .tracker-controls {
            grid-template-columns: 1fr !important;
          }

          .tracker-stats {
            grid-template-columns:
              1fr 1fr !important;
          }
        }
      `}</style>
    </div>
  );
}

/* =============================================================== */
/* LEAGUE TRACKER */
/* =============================================================== */

function LeagueTracker({
  data,
  entryFees,
  onEntryFeeChange,
  trackerLeagueTypeFilter,
  setTrackerLeagueTypeFilter,
  trackerSearch,
  setTrackerSearch,
  trackerRows,
  trackerStats,
}) {
  // Which league row is open to show full standings.
  const [expandedLeagueId, setExpandedLeagueId] =
    useState(null);

  const ownedByLeagueId = useMemo(() => {
    const map = {};

    (data.owned || []).forEach((bundle) => {
      map[bundle.league.league_id] = bundle;
    });

    return map;
  }, [data]);

  const rosterCounts =
    useMemo(() => {
      const counts = {};

      (data.owned || []).forEach(
        ({
          league,
          rosters,
        }) => {
          counts[
            league.league_id
          ] = rosters.length;
        }
      );

      return counts;
    }, [data]);

  /*
   * Per-league record, win %, and playoff
   * projection for the leagues this user
   * actually has a roster in.
   */
  const leagueStandings =
    useMemo(() => {
      const map = {};

      (data.owned || []).forEach(
        ({
          league,
          rosters,
          myRoster,
        }) => {
          const standings =
            computeStandings(rosters);

          const myStanding =
            standings.find(
              (s) =>
                s.roster.roster_id ===
                myRoster.roster_id
            );

          if (!myStanding) return;

          const projection =
            getPlayoffProjection({
              rank: myStanding.rank,
              totalTeams:
                rosters.length,
              playoffTeams:
                league.settings
                  ?.playoff_teams,
            });

          map[league.league_id] = {
            wins: myStanding.wins,
            losses: myStanding.losses,
            ties: myStanding.ties,
            winPct: myStanding.winPct,
            rank: myStanding.rank,
            totalTeams:
              rosters.length,
            projection,
          };
        }
      );

      return map;
    }, [data]);

  /*
   * Aggregate summary across whichever leagues
   * are currently visible (respects the type
   * filter and search box): overall win %, how
   * many leagues are winning/losing/even, and
   * how many are currently on pace for the
   * playoffs.
   */
  const recordSummary =
    useMemo(() => {
      let wins = 0;
      let losses = 0;
      let ties = 0;

      let winningLeagues = 0;
      let losingLeagues = 0;
      let evenLeagues = 0;
      let ratedLeagues = 0;

      let playoffCount = 0;
      let projectedLeagues = 0;

      (trackerRows || []).forEach(
        (league) => {
          const standing =
            leagueStandings[
              league.league_id
            ];

          if (!standing) return;

          wins += standing.wins;
          losses += standing.losses;
          ties += standing.ties;

          const totalGames =
            standing.wins +
            standing.losses +
            standing.ties;

          if (totalGames > 0) {
            ratedLeagues += 1;

            if (standing.winPct > 0.5) {
              winningLeagues += 1;
            } else if (
              standing.winPct < 0.5
            ) {
              losingLeagues += 1;
            } else {
              evenLeagues += 1;
            }
          }

          projectedLeagues += 1;

          if (
            standing.projection
              .label ===
              "Projected #1 seed" ||
            standing.projection
              .label ===
              "Projected playoff team"
          ) {
            playoffCount += 1;
          }
        }
      );

      const totalGames =
        wins + losses + ties;

      const winPct =
        totalGames > 0
          ? (wins + ties * 0.5) /
            totalGames
          : null;

      return {
        winPct,
        winningLeagues,
        losingLeagues,
        evenLeagues,
        ratedLeagues,
        playoffCount,
        projectedLeagues,
      };
    }, [
      trackerRows,
      leagueStandings,
    ]);

  return (
    <div>
      {/* ========================================================= */}
      {/* TRACKER HEADER */}
      {/* ========================================================= */}

      <div
        style={{
          display: "flex",
          alignItems:
            "flex-end",
          justifyContent:
            "space-between",
          gap: 15,
          marginBottom: 18,
          flexWrap:
            "wrap",
        }}
      >
        <div>
          <div
            style={{
              display:
                "flex",
              alignItems:
                "center",
              gap: 9,
            }}
          >
            <div
              style={{
                width: 4,
                height: 23,
                background:
                  COLORS.turf,
                borderRadius: 4,
              }}
            />

            <div
              style={{
                fontFamily:
                  FONT_HEAD,
                fontSize: 27,
                fontWeight: 700,
              }}
            >
              League tracker
            </div>
          </div>

          <div
            style={{
              color:
                COLORS.textMuted,
              fontSize: 12,
              marginTop: 5,
              marginLeft: 13,
            }}
          >
            Track your entry fees across
            every Sleeper league.
          </div>
        </div>

        <div
          style={{
            color:
              COLORS.textMuted,
            fontSize: 10,
            textAlign:
              "right",
          }}
        >
          Fees are saved automatically
          <br />
          to this browser.
        </div>
      </div>

      {/* ========================================================= */}
      {/* TRACKER STATS */}
      {/* ========================================================= */}

      <div
        className="tracker-stats"
        style={{
          display: "grid",
          gridTemplateColumns:
            "repeat(3, minmax(0, 1fr))",
          gap: 10,
          marginBottom: 20,
        }}
      >
        <StatCard
          icon={Layers}
          label="Leagues"
          value={
            trackerStats.leagues
          }
          accent={
            COLORS.turf
          }
        />

        <StatCard
          icon={TrendingUp}
          label="Overall win %"
          value={formatWinPct(
            recordSummary.winPct
          )}
          accent={recordColor(
            recordSummary.winPct
          )}
        />

        <StatCard
          icon={BarChart3}
          label="Leagues won-lost-even"
          value={`${recordSummary.winningLeagues}-${recordSummary.losingLeagues}-${recordSummary.evenLeagues}`}
          accent={
            recordSummary.winningLeagues >=
            recordSummary.losingLeagues
              ? COLORS.turf
              : COLORS.rival
          }
        />

        <StatCard
          icon={Trophy}
          label="On pace for playoffs"
          value={`${recordSummary.playoffCount}/${recordSummary.projectedLeagues}`}
          accent={
            COLORS.yellow
          }
        />

        <StatCard
          icon={Target}
          label="Fees entered"
          value={`${trackerStats.tracked}/${trackerStats.leagues}`}
          accent={
            COLORS.blue
          }
        />

        <StatCard
          icon={DollarSign}
          label="Total entry fees"
          value={formatMoney(
            trackerStats.total
          )}
          accent={
            COLORS.yellow
          }
        />
      </div>

      {/* ========================================================= */}
      {/* FILTERS */}
      {/* ========================================================= */}

      <div
        style={{
          background:
            COLORS.surface,
          border: `1px solid ${COLORS.line}`,
          borderRadius: 13,
          padding: 14,
          marginBottom: 14,
        }}
      >
        <div
          className="tracker-controls"
          style={{
            display: "grid",
            gridTemplateColumns:
              "minmax(220px, 1fr) auto",
            gap: 9,
            alignItems:
              "center",
          }}
        >
          {/* Search */}

          <div
            style={{
              position:
                "relative",
            }}
          >
            <Search
              size={15}
              color={
                COLORS.textMuted
              }
              style={{
                position:
                  "absolute",
                left: 11,
                top: 10,
              }}
            />

            <input
              value={
                trackerSearch
              }
              onChange={(e) =>
                setTrackerSearch(
                  e.target.value
                )
              }
              placeholder="Search leagues..."
              style={{
                width: "100%",
                height: 36,
                background:
                  COLORS.surfaceRaised,
                border: `1px solid ${COLORS.line}`,
                borderRadius: 8,
                padding:
                  "8px 11px 8px 34px",
                color:
                  COLORS.text,
                fontSize: 12,
              }}
            />
          </div>

          {/* League Type */}

          <select
            className="filter-select"
            value={
              trackerLeagueTypeFilter
            }
            onChange={(e) =>
              setTrackerLeagueTypeFilter(
                e.target.value
              )
            }
            aria-label="Filter tracker by league type"
            style={{
              height: 36,
              minWidth: 160,
              background:
                COLORS.surfaceRaised,
              color:
                COLORS.text,
              border: `1px solid ${COLORS.line}`,
              borderRadius: 8,
              padding:
                "0 10px",
              fontSize: 11,
              fontWeight: 700,
              cursor:
                "pointer",
            }}
          >
            <option value="all">
              All league types
            </option>

            <option value="Best Ball">
              Best Ball
            </option>

            <option value="Redraft">
              Redraft
            </option>

            <option value="Dynasty">
              Dynasty
            </option>

            <option value="Keeper">
              Keeper
            </option>

            <option value="Other">
              Other
            </option>
          </select>
        </div>

        {(trackerLeagueTypeFilter !==
          "all" ||
          trackerSearch) && (
          <div
            style={{
              display:
                "flex",
              alignItems:
                "center",
              gap: 8,
              marginTop: 10,
              padding:
                "7px 9px",
              background:
                "rgba(101,198,83,0.055)",
              border:
                "1px solid rgba(101,198,83,0.14)",
              borderRadius: 7,
              color:
                COLORS.textDim,
              fontSize: 10,
            }}
          >
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius:
                  "50%",
                background:
                  COLORS.turf,
              }}
            />

            Showing{" "}
            <strong
              style={{
                color:
                  COLORS.text,
              }}
            >
              {
                trackerStats.leagues
              }
            </strong>{" "}
            league
            {trackerStats.leagues ===
            1
              ? ""
              : "s"}

            {trackerLeagueTypeFilter !==
              "all" &&
              ` · ${trackerLeagueTypeFilter}`}

            {trackerSearch &&
              ` · "${trackerSearch}"`}

            <button
              type="button"
              onClick={() => {
                setTrackerLeagueTypeFilter(
                  "all"
                );
                setTrackerSearch("");
              }}
              style={{
                marginLeft:
                  "auto",
                background:
                  "transparent",
                border:
                  "none",
                color:
                  COLORS.turf,
                fontSize: 10,
                fontWeight: 700,
                cursor:
                  "pointer",
                padding:
                  "2px 4px",
              }}
            >
              Clear filters
            </button>
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* LEAGUE LIST */}
      {/* ========================================================= */}

      <div
        style={{
          border: `1px solid ${COLORS.line}`,
          borderRadius: 14,
          overflow:
            "hidden",
          background:
            COLORS.surface,
        }}
      >
        {/* Header */}

        <div
          className="tracker-header-grid"
          style={{
            display: "grid",
            gridTemplateColumns:
              "minmax(260px,1fr) 130px 90px 140px",
            gap: 14,
            alignItems:
              "center",
            padding:
              "10px 16px",
            background:
              "rgba(255,255,255,0.015)",
            borderBottom:
              `1px solid ${COLORS.line}`,
            color:
              COLORS.textMuted,
            fontSize: 9,
            fontWeight: 800,
            textTransform:
              "uppercase",
            letterSpacing:
              "0.1em",
          }}
        >
          <div>League</div>
          <div>Setting</div>
          <div>Teams</div>
          <div
            style={{
              textAlign:
                "right",
            }}
          >
            Entry fee
          </div>
        </div>

        {/* Rows */}

        {trackerRows.map(
          (league, index) => {
            const type =
              getLeagueType(
                league
              );

            const typeColor =
              leagueTypeColor(
                type
              );

            const savedFee =
              entryFees[
                league.league_id
              ];

            const teamCount =
              league.total_rosters ||
              rosterCounts[
                league.league_id
              ] ||
              "—";

            const standing =
              leagueStandings[
                league.league_id
              ];

            const leagueBundle =
              ownedByLeagueId[
                league.league_id
              ];

            const canExpand =
              Boolean(leagueBundle);

            const isOpen =
              canExpand &&
              expandedLeagueId ===
                league.league_id;

            const toggleLeague = () =>
              setExpandedLeagueId(
                isOpen
                  ? null
                  : league.league_id
              );

            return (
              <div
                key={
                  league.league_id
                }
              >
              <div
                className="tracker-row tracker-row-grid"
                role={
                  canExpand
                    ? "button"
                    : undefined
                }
                tabIndex={
                  canExpand ? 0 : undefined
                }
                aria-expanded={
                  canExpand
                    ? isOpen
                    : undefined
                }
                onClick={
                  canExpand
                    ? toggleLeague
                    : undefined
                }
                onKeyDown={
                  canExpand
                    ? (e) => {
                        // Ignore keys typed in the fee input.
                        if (
                          e.target !==
                          e.currentTarget
                        )
                          return;

                        if (
                          e.key ===
                            "Enter" ||
                          e.key === " "
                        ) {
                          e.preventDefault();
                          toggleLeague();
                        }
                      }
                    : undefined
                }
                style={{
                  cursor: canExpand
                    ? "pointer"
                    : "default",
                  display: "grid",
                  gridTemplateColumns:
                    "minmax(260px,1fr) 130px 90px 140px",
                  gap: 14,
                  alignItems:
                    "center",
                  padding:
                    "13px 16px",
                  background:
                    index % 2 === 0
                      ? COLORS.surface
                      : COLORS.bg,
                  borderTop:
                    index === 0
                      ? "none"
                      : `1px solid ${COLORS.line}`,
                }}
              >
                {/* League name */}

                <div
                  className="tracker-league-info"
                  style={{
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      display:
                        "flex",
                      alignItems:
                        "center",
                      gap: 8,
                      minWidth: 0,
                    }}
                  >
                    <div
                      style={{
                        width: 5,
                        height: 24,
                        borderRadius: 4,
                        background:
                          typeColor,
                        flexShrink: 0,
                      }}
                    />

                    <div
                      style={{
                        minWidth: 0,
                      }}
                    >
                      <div
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                          overflow:
                            "hidden",
                          textOverflow:
                            "ellipsis",
                          whiteSpace:
                            "nowrap",
                        }}
                      >
                        {
                          league.name
                        }
                      </div>

                      <div
                        style={{
                          color:
                            COLORS.textMuted,
                          fontSize: 9,
                          marginTop: 4,
                        }}
                      >
                        League ID ·{" "}
                        {
                          league.league_id
                        }
                      </div>

                      {standing && (
                        <div
                          style={{
                            display:
                              "flex",
                            alignItems:
                              "center",
                            flexWrap:
                              "wrap",
                            gap: 6,
                            marginTop: 7,
                          }}
                        >
                          {/* Record pill */}
                          <span
                            title={`Win rate: ${formatWinPct(
                              standing.winPct
                            )}`}
                            style={{
                              display:
                                "inline-flex",
                              alignItems:
                                "center",
                              padding:
                                "3px 7px",
                              borderRadius: 5,
                              background: `${recordColor(
                                standing.winPct
                              )}14`,
                              border: `1px solid ${recordColor(
                                standing.winPct
                              )}35`,
                              color:
                                recordColor(
                                  standing.winPct
                                ),
                              fontSize: 10,
                              fontWeight: 800,
                              fontFamily:
                                FONT_HEAD,
                              letterSpacing:
                                "0.03em",
                            }}
                          >
                            {formatRecord(
                              standing
                            )}
                          </span>

                          {/* Win % */}
                          <span
                            style={{
                              color:
                                COLORS.textMuted,
                              fontSize: 9,
                              fontWeight: 700,
                            }}
                          >
                            {formatWinPct(
                              standing.winPct
                            )}{" "}
                            win rate
                          </span>

                          {/* Playoff projection pill */}
                          <span
                            style={{
                              display:
                                "inline-flex",
                              alignItems:
                                "center",
                              padding:
                                "3px 7px",
                              borderRadius: 5,
                              background: `${standing.projection.color}12`,
                              border: `1px solid ${standing.projection.color}30`,
                              color:
                                standing
                                  .projection
                                  .color,
                              fontSize: 9,
                              fontWeight: 800,
                              textTransform:
                                "uppercase",
                              letterSpacing:
                                "0.03em",
                            }}
                          >
                            {
                              standing
                                .projection
                                .label
                            }
                          </span>
                        </div>
                      )}
                    </div>

                    {canExpand &&
                      (isOpen ? (
                        <ChevronUp
                          size={15}
                          color={
                            COLORS.textDim
                          }
                          style={{
                            flexShrink: 0,
                            marginLeft:
                              "auto",
                          }}
                        />
                      ) : (
                        <ChevronDown
                          size={15}
                          color={
                            COLORS.textDim
                          }
                          style={{
                            flexShrink: 0,
                            marginLeft:
                              "auto",
                          }}
                        />
                      ))}
                  </div>
                </div>

                {/* Type */}

                <div
                  className="tracker-type"
                >
                  <span
                    style={{
                      display:
                        "inline-flex",
                      alignItems:
                        "center",
                      padding:
                        "4px 7px",
                      borderRadius: 5,
                      background:
                        `${typeColor}12`,
                      border:
                        `1px solid ${typeColor}30`,
                      color:
                        typeColor,
                      fontSize: 9,
                      fontWeight: 800,
                      letterSpacing:
                        "0.04em",
                    }}
                  >
                    {type}
                  </span>
                </div>

                {/* Teams */}

                <div
                  className="tracker-team-count"
                  style={{
                    color:
                      COLORS.textDim,
                    fontSize: 11,
                  }}
                >
                  <strong
                    style={{
                      color:
                        COLORS.text,
                    }}
                  >
                    {
                      teamCount
                    }
                  </strong>{" "}
                  teams
                </div>

                {/* Entry Fee */}

                <div
                  style={{
                    display:
                      "flex",
                    alignItems:
                      "center",
                    justifyContent:
                      "flex-end",
                    gap: 7,
                    cursor: "default",
                  }}
                  onClick={(e) =>
                    e.stopPropagation()
                  }
                >
                  <div
                    style={{
                      position:
                        "relative",
                      width: 120,
                    }}
                  >
                    <span
                      style={{
                        position:
                          "absolute",
                        left: 10,
                        top: 9,
                        color:
                          COLORS.textMuted,
                        fontSize: 12,
                        pointerEvents:
                          "none",
                      }}
                    >
                      $
                    </span>

                    <input
                      className="tracker-fee-input"
                      type="number"
                      min="0"
                      step="0.01"
                      value={
                        savedFee ??
                        ""
                      }
                      onChange={(e) =>
                        onEntryFeeChange(
                          league.league_id,
                          e.target.value
                        )
                      }
                      placeholder="0.00"
                      aria-label={`Entry fee for ${league.name}`}
                      style={{
                        width:
                          "100%",
                        height: 34,
                        background:
                          COLORS.surfaceRaised,
                        border: `1px solid ${
                          savedFee !==
                            undefined &&
                          savedFee !==
                            ""
                            ? "rgba(101,198,83,0.35)"
                            : COLORS.line
                        }`,
                        borderRadius: 7,
                        padding:
                          "7px 8px 7px 23px",
                        color:
                          COLORS.text,
                        fontSize: 12,
                        fontWeight: 700,
                      }}
                    />
                  </div>

                  {savedFee !==
                    undefined &&
                    savedFee !==
                      "" && (
                      <span
                        style={{
                          color:
                            COLORS.turf,
                          fontSize: 9,
                          fontWeight: 800,
                        }}
                        title="Saved"
                      >
                        ✓
                      </span>
                    )}
                </div>
              </div>

              {isOpen && (
                <div
                  style={{
                    padding:
                      "4px 16px 10px 29px",
                    background:
                      COLORS.bg,
                    borderTop: `1px solid ${COLORS.line}`,
                  }}
                >
                  <LeagueStandingsTable
                    bundle={
                      leagueBundle
                    }
                  />
                </div>
              )}
              </div>
            );
          }
        )}

        {/* Empty state */}

        {trackerRows.length ===
          0 && (
          <div
            style={{
              padding: 40,
              textAlign:
                "center",
              color:
                COLORS.textMuted,
              fontSize: 13,
            }}
          >
            No leagues match the
            selected filters.
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* TRACKER FOOTNOTE */}
      {/* ========================================================= */}

      <div
        style={{
          display:
            "flex",
          alignItems:
            "center",
          justifyContent:
            "center",
          gap: 7,
          color:
            COLORS.textMuted,
          fontSize: 10,
          marginTop: 18,
          textAlign:
            "center",
        }}
      >
        <DollarSign
          size={12}
        />

        Entry fees are saved locally
        for your Sleeper account and{" "}
        {data.season} season.
      </div>
    </div>
  );
}

/* =============================================================== */
/* LEAGUE STANDINGS TABLE (expanded league in Exposure tab) */
/* =============================================================== */

function LeagueStandingsTable({ bundle }) {
  const { league, rosters, users, myRoster } = bundle;

  const standings = useMemo(
    () => computeStandings(rosters),
    [rosters]
  );

  const totalTeams = standings.length;

  const configuredPlayoffTeams =
    league.settings?.playoff_teams;

  const hasConfiguredCutoff =
    Number.isFinite(configuredPlayoffTeams) &&
    configuredPlayoffTeams > 0;

  // Same fallback used by the playoff projection.
  const playoffTeams = hasConfiguredCutoff
    ? Math.min(configuredPlayoffTeams, totalTeams)
    : Math.max(2, Math.ceil(totalTeams / 2));

  const hasTies = standings.some((s) => s.ties > 0);
  const gamesPlayed = standings.some(
    (s) => s.totalGames > 0
  );

  const columns = hasTies
    ? "30px minmax(130px, 1fr) 40px 40px 40px 72px 72px"
    : "30px minmax(130px, 1fr) 44px 44px 72px 72px";

  function teamName(roster) {
    const owner = users.find(
      (u) => u.user_id === roster.owner_id
    );

    return (
      owner?.metadata?.team_name ||
      owner?.display_name ||
      `Team ${roster.roster_id}`
    );
  }

  const headerCell = {
    fontSize: 9,
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.09em",
    color: COLORS.textMuted,
  };

  const numCell = {
    textAlign: "right",
    fontVariantNumeric: "tabular-nums",
  };

  return (
    <div
      style={{
        margin: "6px 0 10px",
        border: `1px solid ${COLORS.line}`,
        borderRadius: 10,
        background: COLORS.surface,
        overflowX: "auto",
      }}
    >
      <div style={{ minWidth: 380 }}>
        {/* Header */}

        <div
          style={{
            display: "grid",
            gridTemplateColumns: columns,
            gap: 8,
            alignItems: "center",
            padding: "8px 12px",
            borderBottom: `1px solid ${COLORS.line}`,
            background: "rgba(255,255,255,0.015)",
          }}
        >
          <div style={headerCell}>#</div>
          <div style={headerCell}>Team</div>
          <div style={{ ...headerCell, ...numCell }}>W</div>
          <div style={{ ...headerCell, ...numCell }}>L</div>
          {hasTies && (
            <div style={{ ...headerCell, ...numCell }}>T</div>
          )}
          <div style={{ ...headerCell, ...numCell }}>PF</div>
          <div style={{ ...headerCell, ...numCell }}>PA</div>
        </div>

        {/* Rows */}

        {standings.map((s, i) => {
          const isMe =
            s.roster.roster_id === myRoster.roster_id;

          const inPlayoffs = s.rank <= playoffTeams;
          const isLastIn = s.rank === playoffTeams;

          return (
            <div key={s.roster.roster_id}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: columns,
                  gap: 8,
                  alignItems: "center",
                  padding: "7px 12px",
                  fontSize: 11,
                  color: COLORS.textDim,
                  background: isMe
                    ? "rgba(101,198,83,0.10)"
                    : "transparent",
                  borderTop:
                    i === 0
                      ? "none"
                      : `1px solid ${COLORS.line}`,
                  borderLeft: `3px solid ${
                    isMe
                      ? COLORS.turf
                      : inPlayoffs
                      ? "rgba(101,198,83,0.35)"
                      : "transparent"
                  }`,
                }}
              >
                <div
                  style={{
                    fontWeight: 800,
                    color: inPlayoffs
                      ? COLORS.turf
                      : COLORS.textMuted,
                  }}
                >
                  {s.rank}
                </div>

                <div
                  style={{
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    fontWeight: isMe ? 700 : 500,
                    color: isMe
                      ? COLORS.text
                      : COLORS.textDim,
                  }}
                >
                  {teamName(s.roster)}
                  {isMe && (
                    <span
                      style={{
                        marginLeft: 6,
                        fontSize: 8,
                        fontWeight: 800,
                        letterSpacing: "0.06em",
                        color: COLORS.turf,
                      }}
                    >
                      YOU
                    </span>
                  )}
                </div>

                <div
                  style={{
                    ...numCell,
                    color: COLORS.text,
                    fontWeight: 700,
                  }}
                >
                  {s.wins}
                </div>

                <div style={numCell}>{s.losses}</div>

                {hasTies && (
                  <div style={numCell}>{s.ties}</div>
                )}

                <div style={{ ...numCell, color: COLORS.text }}>
                  {s.fpts.toFixed(2)}
                </div>

                <div style={numCell}>
                  {s.fptsAgainst.toFixed(2)}
                </div>
              </div>

              {/* Playoff line */}

              {isLastIn && i < standings.length - 1 && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "3px 12px",
                    borderTop: `1px dashed ${COLORS.turf}`,
                    background: "rgba(101,198,83,0.05)",
                    color: COLORS.turf,
                    fontSize: 8,
                    fontWeight: 800,
                    letterSpacing: "0.09em",
                    textTransform: "uppercase",
                  }}
                >
                  Playoff line · top {playoffTeams} advance
                  {!hasConfiguredCutoff && " (estimated)"}
                </div>
              )}
            </div>
          );
        })}

        {!gamesPlayed && (
          <div
            style={{
              padding: "8px 12px",
              borderTop: `1px solid ${COLORS.line}`,
              color: COLORS.textMuted,
              fontSize: 10,
            }}
          >
            No games played yet — standings will fill in as
            the season progresses.
          </div>
        )}
      </div>
    </div>
  );
}

/* =============================================================== */
/* STAT CARD */
/* =============================================================== */

function StatCard({
  icon: Icon,
  label,
  value,
  accent,
}) {
  return (
    <div
      className="stat-card"
      style={{
        background:
          COLORS.surface,
        border: `1px solid ${COLORS.line}`,
        borderRadius: 13,
        padding:
          "15px 16px",
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems:
            "center",
          justifyContent:
            "space-between",
          marginBottom: 11,
        }}
      >
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 8,
            background: `${accent}12`,
            display:
              "flex",
            alignItems:
              "center",
            justifyContent:
              "center",
            color: accent,
          }}
        >
          <Icon size={15} />
        </div>

        <div
          style={{
            width: 5,
            height: 5,
            borderRadius:
              "50%",
            background:
              accent,
            opacity: 0.65,
          }}
        />
      </div>

      <div
        style={{
          fontFamily:
            FONT_HEAD,
          fontSize: 32,
          lineHeight: 0.95,
          fontWeight: 800,
          color:
            COLORS.text,
        }}
      >
        {value}
      </div>

      <div
        style={{
          color:
            COLORS.textMuted,
          fontSize: 10,
          fontWeight: 600,
          marginTop: 6,
          textTransform:
            "uppercase",
          letterSpacing:
            "0.06em",
        }}
      >
        {label}
      </div>
    </div>
  );
}

/* =============================================================== */
/* EXPOSURE PANEL */
/* =============================================================== */

function ExposurePanel({
  title,
  subtitle,
  description,
  icon: Icon,
  color,
  rows,
  total,
  emptyText,
}) {
  return (
    <div
      style={{
        background:
          COLORS.surface,
        border: `1px solid ${COLORS.line}`,
        borderRadius: 14,
        padding: 16,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems:
            "flex-start",
          gap: 10,
          marginBottom: 7,
        }}
      >
        <div
          style={{
            width: 31,
            height: 31,
            borderRadius: 8,
            background: `${color}12`,
            color,
            display:
              "flex",
            alignItems:
              "center",
            justifyContent:
              "center",
            flexShrink: 0,
          }}
        >
          <Icon size={16} />
        </div>

        <div
          style={{
            minWidth: 0,
          }}
        >
          <div
            style={{
              fontFamily:
                FONT_HEAD,
              fontSize: 23,
              fontWeight: 700,
              lineHeight: 1,
            }}
          >
            {title}
          </div>

          <div
            style={{
              color,
              fontSize: 9,
              fontWeight: 800,
              textTransform:
                "uppercase",
              letterSpacing:
                "0.07em",
              marginTop: 5,
            }}
          >
            {subtitle}
          </div>
        </div>
      </div>

      <div
        style={{
          color:
            COLORS.textMuted,
          fontSize: 11,
          lineHeight: 1.5,
          marginBottom: 13,
        }}
      >
        {description}
      </div>

      {rows.length === 0 ? (
        <div
          style={{
            border: `1px dashed ${COLORS.line}`,
            borderRadius: 9,
            padding:
              "18px 12px",
            color:
              COLORS.textMuted,
            fontSize: 11,
            textAlign:
              "center",
          }}
        >
          {emptyText}
        </div>
      ) : (
        rows.map(
          (row, index) => (
            <MiniExposureRow
              key={row.pid}
              row={row}
              total={total}
              color={color}
              rank={index + 1}
            />
          )
        )
      )}
    </div>
  );
}

/* =============================================================== */
/* MINI EXPOSURE ROW */
/* =============================================================== */

function MiniExposureRow({
  row,
  total,
  color,
  rank,
}) {
  const pct = Math.round(
    (row.starterCount /
      total) *
      100
  );

  return (
    <div
      className="player-card"
      style={{
        display: "grid",
        gridTemplateColumns:
          "22px minmax(0,1fr) auto",
        gap: 9,
        alignItems:
          "center",
        padding:
          "9px 8px",
        borderRadius: 9,
        border:
          "1px solid transparent",
        marginTop: 3,
      }}
    >
      <div
        style={{
          color:
            COLORS.textMuted,
          fontFamily:
            FONT_HEAD,
          fontSize: 13,
          fontWeight: 700,
          textAlign:
            "center",
        }}
      >
        {rank}
      </div>

      <div
        style={{
          minWidth: 0,
        }}
      >
        <div
          style={{
            display:
              "flex",
            alignItems:
              "center",
            gap: 6,
          }}
        >
          <div
            style={{
              width: 4,
              height: 18,
              borderRadius: 3,
              background:
                positionColor(
                  row.position
                ),
            }}
          />

          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              overflow:
                "hidden",
              textOverflow:
                "ellipsis",
              whiteSpace:
                "nowrap",
            }}
          >
            {row.name}
          </span>

          <span
            style={{
              color:
                COLORS.textMuted,
              fontSize: 9,
              whiteSpace:
                "nowrap",
            }}
          >
            {row.position}
          </span>
        </div>

        <div
          style={{
            display:
              "flex",
            alignItems:
              "center",
            gap: 7,
            marginTop: 5,
          }}
        >
          <div
            style={{
              height: 4,
              flex: 1,
              background:
                COLORS.line,
              borderRadius: 10,
              overflow:
                "hidden",
            }}
          >
            <div
              style={{
                height:
                  "100%",
                width: `${Math.min(
                  pct,
                  100
                )}%`,
                background:
                  color,
                borderRadius:
                  10,
              }}
            />
          </div>

          <span
            style={{
              color:
                COLORS.textMuted,
              fontSize: 9,
              whiteSpace:
                "nowrap",
            }}
          >
            {
              row.starterCount
            }
            /
            {total}
          </span>
        </div>
      </div>

      <div
        style={{
          fontFamily:
            FONT_HEAD,
          fontSize: 20,
          fontWeight: 800,
          color,
        }}
      >
        {pct}%
      </div>
    </div>
  );
}