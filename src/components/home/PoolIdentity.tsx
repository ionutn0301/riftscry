import roster from "../../data/champions.json";
export default function PoolIdentity({
  id,
  compact = false,
}: {
  id: string;
  compact?: boolean;
}) {
  const key = Object.keys(roster.champions).find(
    (key) => key.toLowerCase() === id.toLowerCase(),
  );
  const champion = key
    ? roster.champions[key as keyof typeof roster.champions]
    : null;
  return (
    <a
      className={compact ? "saved-identity compact" : "saved-identity"}
      href={`/champion/${id.toLowerCase()}`}
    >
      {key && (
        <img
          src={`https://ddragon.leagueoflegends.com/cdn/${roster.assetVersion}/img/champion/${key}.png`}
          width={compact ? 28 : 64}
          height={compact ? 28 : 64}
          alt=""
          loading="lazy"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      )}
      <span>
        {champion?.name ?? id}
        {!compact && champion && <small>{champion.title}</small>}
      </span>
    </a>
  );
}
