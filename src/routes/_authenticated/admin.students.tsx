import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Check, X, UserCheck, UserX, Trash2, ShieldCheck, ShieldOff, Search } from "lucide-react";
import { api } from "@/lib/api-client";
import { useState, useMemo } from "react";

export const Route = createFileRoute("/_authenticated/admin/students")({
  head: () => ({ meta: [{ title: "Students — Admin" }] }),
  component: AdminStudents,
});

function AdminStudents() {
  // Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "registered" | "pending">("all");
  const [courseFilter, setCourseFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [sectionFilter, setSectionFilter] = useState("all");

  const { data: myRoles } = useQuery({
    queryKey: ["my-roles-students-page"],
    queryFn: () => api.queries.roles(),
  });
  const isAdmin = myRoles?.isAdmin ?? false;

  const { data: students, isLoading, refetch } = useQuery({
    queryKey: ["admin-students"],
    queryFn: () => api.admin.getStudents(),
  });

  async function toggleRegistration(id: string, currentStatus: boolean) {
    try {
      await api.admin.updateStudentRegistration(id, !currentStatus);
      toast.success(currentStatus ? "Student registration revoked." : "Student registered successfully.");
      refetch();
    } catch (e: any) {
      toast.error(e.message || "Failed to update registration status.");
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Are you sure you want to delete ${name}? This action cannot be undone.`)) {
      return;
    }
    try {
      await api.admin.deleteStudent(id);
      toast.success(`Student ${name} deleted successfully.`);
      refetch();
    } catch (e: any) {
      toast.error(e.message || "Failed to delete student.");
    }
  }

  async function handleToggleOfficer(id: string, name: string, isOfficer: boolean) {
    try {
      await api.admin.toggleOfficer(id, !isOfficer);
      toast.success(
        isOfficer ? `Officer role removed from ${name}.` : `${name} is now an Officer.`
      );
      refetch();
    } catch (e: any) {
      toast.error(e.message || "Failed to update officer role.");
    }
  }

  // Dynamic filter lists from loaded students
  const courses = useMemo(() => {
    if (!students) return [];
    const set = new Set(students.map((s: any) => s.course).filter(Boolean));
    return Array.from(set).sort() as string[];
  }, [students]);

  const yearLevels = useMemo(() => {
    if (!students) return [];
    const set = new Set(students.map((s: any) => s.year_level).filter(Boolean));
    return Array.from(set).sort((a: any, b: any) => Number(a) - Number(b)) as number[];
  }, [students]);

  const sections = useMemo(() => {
    if (!students) return [];
    const set = new Set(students.map((s: any) => s.section).filter(Boolean));
    return Array.from(set).sort() as string[];
  }, [students]);

  // Client-side filtering logic
  const filteredStudents = useMemo(() => {
    if (!students) return [];
    return students.filter((student: any) => {
      const matchesSearch =
        student.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        student.student_id.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "registered" && student.is_registered) ||
        (statusFilter === "pending" && !student.is_registered);
      const matchesCourse = courseFilter === "all" || student.course === courseFilter;
      const matchesYear = yearFilter === "all" || String(student.year_level) === yearFilter;
      const matchesSection = sectionFilter === "all" || student.section === sectionFilter;
      return matchesSearch && matchesStatus && matchesCourse && matchesYear && matchesSection;
    }).sort((a: any, b: any) => a.full_name.localeCompare(b.full_name));
  }, [students, searchTerm, statusFilter, courseFilter, yearFilter, sectionFilter]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="font-display text-3xl">Registered Students</h1>
          <p className="text-muted-foreground">Manage student registration and voting access.</p>
        </div>
      </div>

      {/* Filters bar - matches the requested mockup */}
      <Card className="p-4 flex flex-wrap gap-4 items-center justify-between shadow-sm">
        <div className="flex-1 min-w-[240px] relative">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search student name or ID..."
            className="pl-9"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium">Status:</span>
            <Select value={statusFilter} onValueChange={(val: any) => setStatusFilter(val)}>
              <SelectTrigger className="w-[130px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Students</SelectItem>
                <SelectItem value="registered">Registered</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium">Course:</span>
            <Select value={courseFilter} onValueChange={setCourseFilter}>
              <SelectTrigger className="w-[130px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Courses</SelectItem>
                {courses.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium">Year:</span>
            <Select value={yearFilter} onValueChange={setYearFilter}>
              <SelectTrigger className="w-[110px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Years</SelectItem>
                {yearLevels.map((y) => <SelectItem key={y} value={String(y)}>Year {y}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium">Section:</span>
            <Select value={sectionFilter} onValueChange={sectionFilter => setSectionFilter(sectionFilter)}>
              <SelectTrigger className="w-[110px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sections</SelectItem>
                {sections.map((s) => <SelectItem key={s} value={s}>Section {s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Student ID</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Course/Year/Section</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Loading students...</td>
                </tr>
              ) : filteredStudents.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No students match the selected criteria.</td>
                </tr>
              ) : (
                filteredStudents.map((student: any) => {
                  const roles: string[] = Array.isArray(student.roles) ? student.roles : [];
                  const isOfficer = roles.includes("officer");
                  return (
                    <tr key={student.id} className="hover:bg-muted/50 transition-colors">
                      <td className="px-4 py-3 font-mono">{student.student_id}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{student.full_name}</span>
                          {isOfficer && (
                            <Badge variant="secondary" className="bg-gold/15 text-gold-foreground border border-gold/30 text-xs">
                              <ShieldCheck className="size-3 mr-1" />Officer
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {student.course} {student.year_level ? `- Year ${student.year_level}` : ""} {student.section ? `- Sec ${student.section}` : ""}
                      </td>
                      <td className="px-4 py-3">
                        {student.is_registered ? (
                          <Badge variant="default" className="bg-success text-success-foreground hover:bg-success/90">
                            <Check className="size-3 mr-1" /> Registered
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="text-muted-foreground">
                            <X className="size-3 mr-1" /> Pending
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2 justify-end items-center">
                          {student.is_registered ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive border-destructive/20 cursor-pointer"
                              onClick={() => toggleRegistration(student.id, true)}
                            >
                              <UserX className="size-4 mr-2" /> Revoke
                            </Button>
                          ) : (
                            <Button
                              variant="default"
                              size="sm"
                              className="bg-primary hover:bg-primary/90 cursor-pointer"
                              onClick={() => toggleRegistration(student.id, false)}
                            >
                              <UserCheck className="size-4 mr-2" /> Approve
                            </Button>
                          )}
                          {isAdmin && (
                            <Button
                              variant="outline"
                              size="sm"
                              className={
                                isOfficer
                                  ? "text-gold border-gold/30 hover:bg-gold/10 cursor-pointer"
                                  : "text-muted-foreground border-border hover:bg-muted cursor-pointer"
                              }
                              onClick={() => handleToggleOfficer(student.id, student.full_name, isOfficer)}
                              title={isOfficer ? "Remove Officer role" : "Grant Officer role"}
                            >
                              {isOfficer ? (
                                <><ShieldOff className="size-4 mr-1" /> Remove Officer</>
                              ) : (
                                <><ShieldCheck className="size-4 mr-1" /> Make Officer</>
                              )}
                            </Button>
                          )}
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive cursor-pointer"
                              onClick={() => handleDelete(student.id, student.full_name)}
                            >
                              <Trash2 className="size-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
