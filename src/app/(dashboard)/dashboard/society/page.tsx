import { requireRole } from "@/lib/session";
import { getSociety } from "@/lib/queries/society";
import { getWingsWithStructure } from "@/lib/queries/wings";
import { SocietySettingsForm } from "@/components/society/society-settings-form";
import { AddWingForm } from "@/components/society/add-wing-form";
import { AddFloorForm } from "@/components/society/add-floor-form";
import { AddFloorDirectForm } from "@/components/society/add-floor-direct-form";
import { AddFlatForm } from "@/components/society/add-flat-form";
import { DeleteButton } from "@/components/society/delete-button";
import { deleteWing } from "@/actions/wings";
import { deleteFloor } from "@/actions/floors";
import { deleteFlat } from "@/actions/flats";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Building2, ChevronRight } from "lucide-react";

export default async function SocietyPage() {
  const session = await requireRole(["ADMIN", "SECRETARY"]);
  const societyId = session.user.societyId!;

  const [society, wings] = await Promise.all([
    getSociety(societyId),
    getWingsWithStructure(societyId),
  ]);

  if (!society) return <p className="text-sm text-muted-foreground">Society not found.</p>;

  const isAdmin = session.user.role === "ADMIN";
  const hasWings = society.hasWings;

  // Stats
  const totalFlats = wings.reduce(
    (a, w) => a + w.floors.reduce((b, fl) => b + fl.flats.length, 0),
    0
  );
  const occupiedFlats = wings.reduce(
    (a, w) =>
      a + w.floors.reduce((b, fl) => b + fl.flats.filter((f) => f.isOccupied).length, 0),
    0
  );

  // All floors flattened (used in wingless view)
  const allFloors = wings
    .flatMap((w) => w.floors)
    .sort((a, b) => a.number - b.number);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold">{society.name}</h2>
        <p className="text-xs text-muted-foreground">
          {[society.city, society.state].filter(Boolean).join(", ")}
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: hasWings ? "Wings" : "Floors", value: hasWings ? wings.filter(w => w.name !== "_default_").length : allFloors.length },
          { label: "Total Flats", value: totalFlats },
          { label: "Occupied", value: occupiedFlats },
        ].map((s) => (
          <Card key={s.label} className="text-center py-3 px-2">
            <p className="text-xl font-bold">{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* Building structure */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4" />
            Building Structure
          </CardTitle>
          {isAdmin && (
            <div className="pt-1">
              {hasWings ? <AddWingForm /> : <AddFloorDirectForm />}
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {hasWings ? (
            // ── With wings ────────────────────────────────
            <>
              {wings.filter(w => w.name !== "_default_").length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No wings yet. Add your first wing above.
                </p>
              )}
              {wings
                .filter((w) => w.name !== "_default_")
                .map((wing) => (
                  <div key={wing.id} className="border rounded-lg p-3 space-y-2">
                    {/* Wing header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">Wing {wing.name}</span>
                        <Badge variant="secondary" className="text-[10px]">
                          {wing.floors.length} floors
                        </Badge>
                      </div>
                      {isAdmin && <DeleteButton action={deleteWing} id={wing.id} label="Wing" />}
                    </div>

                    {isAdmin && <AddFloorForm wingId={wing.id} />}

                    {/* Floors */}
                    {wing.floors.map((floor) => (
                      <div key={floor.id} className="ml-3 border-l-2 border-slate-100 pl-3 space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <ChevronRight className="h-3 w-3 text-muted-foreground" />
                            <span className="text-xs font-medium">Floor {floor.number}</span>
                            <Badge variant="outline" className="text-[10px] h-4">
                              {floor.flats.length} flats
                            </Badge>
                          </div>
                          {isAdmin && <DeleteButton action={deleteFloor} id={floor.id} label="Floor" />}
                        </div>
                        <div className="flex flex-wrap gap-1.5 ml-4">
                          {floor.flats.map((flat) => (
                            <div key={flat.id} className="flex items-center gap-0.5">
                              <Badge
                                variant={flat.isOccupied ? "default" : "outline"}
                                className="text-[11px] px-2 py-0.5"
                              >
                                {flat.number}
                              </Badge>
                              {isAdmin && <DeleteButton action={deleteFlat} id={flat.id} label="Flat" />}
                            </div>
                          ))}
                        </div>
                        {isAdmin && <AddFlatForm floorId={floor.id} />}
                      </div>
                    ))}
                  </div>
                ))}
            </>
          ) : (
            // ── Without wings ─────────────────────────────
            <>
              {allFloors.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No floors yet. Add your first floor above.
                </p>
              )}
              {allFloors.map((floor) => (
                <div key={floor.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">Floor {floor.number}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {floor.flats.length} flats
                      </Badge>
                    </div>
                    {isAdmin && <DeleteButton action={deleteFloor} id={floor.id} label="Floor" />}
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {floor.flats.map((flat) => (
                      <div key={flat.id} className="flex items-center gap-0.5">
                        <Badge
                          variant={flat.isOccupied ? "default" : "outline"}
                          className="text-[11px] px-2 py-0.5"
                        >
                          {flat.number}
                        </Badge>
                        {isAdmin && <DeleteButton action={deleteFlat} id={flat.id} label="Flat" />}
                      </div>
                    ))}
                  </div>

                  {isAdmin && <AddFlatForm floorId={floor.id} />}
                </div>
              ))}
            </>
          )}
        </CardContent>
      </Card>

      <Separator />

      {/* Society settings (admin only) */}
      {isAdmin && <SocietySettingsForm society={society} />}
    </div>
  );
}
