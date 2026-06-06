import { IconButton, Tooltip } from "@mui/material";
import { Star, StarBorder } from "@mui/icons-material";

export function FavoriteToggleButton({
  disabled,
  isFavorite,
  onToggleFavorite,
}: {
  disabled: boolean;
  isFavorite: boolean;
  onToggleFavorite: () => void;
}) {
  return (
    <Tooltip title={isFavorite ? "お気に入り解除" : "お気に入り"}>
      <span>
        <IconButton
          aria-label={isFavorite ? "お気に入り解除" : "お気に入り"}
          disabled={disabled}
          size="small"
          onClick={onToggleFavorite}
          sx={{ ml: 0.5 }}
        >
          {isFavorite ? (
            <Star sx={{ color: "#bf8700" }} fontSize="small" />
          ) : (
            <StarBorder fontSize="small" />
          )}
        </IconButton>
      </span>
    </Tooltip>
  );
}
