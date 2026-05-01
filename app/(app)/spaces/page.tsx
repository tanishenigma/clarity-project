"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import Link from "next/link";
import {
  Plus,
  Search,
  Loader2,
  FolderPlus,
  Lock,
  LogIn,
  X,
  FilterX,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Space } from "@/lib/types/space";
import CreateSpaceModal from "@/components/spaces-components/create-space-modal";
import SpaceCard from "@/components/spaces-components/space-card";

export default function SpacesPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [subjectFilter, setSubjectFilter] = useState("all");

  const applyOrder = (fetched: Space[], userId: string) => {
    const savedOrder = localStorage.getItem(`sidebar-spaces-order-${userId}`);
    if (!savedOrder) return fetched;
    try {
      const ids: string[] = JSON.parse(savedOrder);
      const map = new Map(fetched.map((s) => [s._id, s]));
      const ordered = ids.filter((id) => map.has(id)).map((id) => map.get(id)!);
      fetched.forEach((s) => {
        if (!ids.includes(s._id)) ordered.push(s);
      });
      return ordered;
    } catch {
      return fetched;
    }
  };

  const fetchSpaces = async () => {
    if (!user) return;

    try {
      const url = `/api/spaces?userId=${user.id}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setSpaces(applyOrder(data.spaces, user.id));
      }
    } catch (error) {
      console.error("Error fetching spaces:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSpaces();
  }, [user]);

  useEffect(() => {
    const handler = (e: Event) => {
      const { ids } = (e as CustomEvent<{ ids: string[] }>).detail;
      setSpaces((prev) => {
        const map = new Map(prev.map((s) => [s._id, s]));
        const ordered = ids
          .filter((id) => map.has(id))
          .map((id) => map.get(id)!);
        prev.forEach((s) => {
          if (!ids.includes(s._id)) ordered.push(s);
        });
        return ordered;
      });
    };
    window.addEventListener("space-reordered", handler);
    return () => window.removeEventListener("space-reordered", handler);
  }, []);

  // Extract unique subjects for the dropdown
  const availableSubjects = useMemo(() => {
    const subs = spaces
      .map((s) => s.subject)
      .filter((s): s is string => !!s && s.trim() !== "");
    return Array.from(new Set(subs)).sort();
  }, [spaces]);

  // Combined Filter logic (Search + Subject)
  const filteredSpaces = useMemo(() => {
    return spaces.filter((space) => {
      const searchTerm = search.toLowerCase();
      const matchesSearch =
        space.name.toLowerCase().includes(searchTerm) ||
        space.subject?.toLowerCase().includes(searchTerm);

      const matchesSubject =
        subjectFilter === "all" || space.subject === subjectFilter;

      return matchesSearch && matchesSubject;
    });
  }, [spaces, search, subjectFilter]);

  const resetFilters = () => {
    setSearch("");
    setSubjectFilter("all");
  };

  const handleUpdate = async (
    id: string,
    updates: { name: string; subject: string; examTarget: string },
  ) => {
    try {
      await fetch(`/api/spaces/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      fetchSpaces();
    } catch (error) {
      console.error("Error updating space:", error);
    }
  };

  const handleDelete = (id: string) => {
    setSpaces((prev) => prev.filter((s) => s._id !== id));
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Card className="w-full max-w-md p-8 text-center 2-lg">
          <div className="flex justify-center mb-6">
            <div className="bg-muted p-4 rounded-full">
              <Lock className="w-8 h-8 text-muted-foreground" />
            </div>
          </div>
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Login Required
          </h2>
          <p className="text-muted-foreground mb-8">
            Please log in to create and manage your study spaces.
          </p>
          <div className="flex gap-4 justify-center">
            <Link href="/auth" className="w-full">
              <Button className="w-full">
                <LogIn className="w-4 h-4 mr-2" />
                Sign In or Register
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Spaces</h1>
          <p className="text-muted-foreground mt-1">
            Organize your study materials by subject
          </p>
        </div>
        <Button className="gap-2" onClick={() => setShowCreateModal(true)}>
          <Plus className="w-4 h-4" />
          New Space
        </Button>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search spaces..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex gap-2">
          <Select value={subjectFilter} onValueChange={setSubjectFilter}>
            <SelectTrigger className="w-full md:w-50">
              <SelectValue placeholder="All Subjects" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subjects</SelectItem>
              {availableSubjects.map((sub) => (
                <SelectItem key={sub} value={sub}>
                  {sub}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {(search !== "" || subjectFilter !== "all") && (
            <Button variant="outline" size="icon" onClick={resetFilters}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      {/* Main Content Area */}
      {!loading && (
        <>
          {/* Case 1: No spaces exist at all */}
          {spaces.length === 0 ? (
            <div className="flex items-center justify-center">
              <Card className="p-12 text-center w-fit ">
                <FolderPlus className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  No spaces yet
                </h3>
                <p className="text-muted-foreground mb-4">
                  Create your first space to start organizing your study
                  materials
                </p>
                <Button
                  onClick={() => setShowCreateModal(true)}
                  className="gap-2">
                  <Plus className="w-4 h-4" />
                  Create Space
                </Button>
              </Card>
            </div>
          ) : /* Case 2: Spaces exist but filtered list is empty */
          filteredSpaces.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <FilterX className="w-12 h-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">No results found</h3>
              <p className="text-muted-foreground mb-4">
                Try adjusting your search or subject filters.
              </p>
              <Button variant="outline" onClick={resetFilters}>
                Clear all filters
              </Button>
            </div>
          ) : (
            /* Case 3: Grid of Spaces */
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {filteredSpaces.map((space) => (
                <SpaceCard
                  key={space._id}
                  space={space}
                  onUpdate={handleUpdate}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </>
      )}

      <CreateSpaceModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={fetchSpaces}
      />
    </div>
  );
}
