import { MapPin, Star } from "lucide-react";
import type { PublicHotelOffer } from "@/server/suppliers/types";
import { amenityLabel, hasFreeCancellation } from "@/lib/hotels";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

function Stars({ count }: { count: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${count} star hotel`}>
      {Array.from({ length: count }, (_, index) => (
        <Star key={index} className="size-3 fill-brand text-brand" aria-hidden="true" />
      ))}
    </span>
  );
}

export function HotelCard({
  hotel,
  active,
  onHover,
  onSelect,
}: {
  hotel: PublicHotelOffer;
  active: boolean;
  onHover: (hotelId: string | null) => void;
  onSelect: (hotelId: string) => void;
}) {
  return (
    <Card
      className={cn(
        "cursor-pointer transition-shadow",
        active ? "border-brand shadow-md" : "hover:shadow-md",
      )}
      onMouseEnter={() => onHover(hotel.hotelId)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onSelect(hotel.hotelId)}
    >
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold">{hotel.name}</h3>
            {hotel.stars !== null && <Stars count={hotel.stars} />}
          </div>

          {hotel.address && (
            <p className="mt-1 flex items-center gap-1.5 text-xs text-fg-muted">
              <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
              <span className="truncate">{hotel.address}</span>
              {hotel.distanceKm !== null && (
                <span className="shrink-0 tabular">· {hotel.distanceKm} km from centre</span>
              )}
            </p>
          )}

          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {hasFreeCancellation(hotel) && <Badge tone="accent">Free cancellation</Badge>}
            {hotel.amenities.slice(0, 3).map((code) => (
              <Badge key={code}>{amenityLabel(code)}</Badge>
            ))}
          </div>
        </div>

        <div className="shrink-0 text-right">
          {hotel.guestRating !== null && (
            <p className="mb-1 text-xs text-fg-muted">
              <span className="font-semibold text-fg tabular">{hotel.guestRating}</span> / 10
            </p>
          )}
          <p className="text-xl font-semibold tabular">
            {hotel.fromPrice.currency} {Number(hotel.fromPrice.amount).toLocaleString("en-GB")}
          </p>
          <p className="text-xs text-fg-muted">total stay</p>
        </div>
      </div>
    </Card>
  );
}
