import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getStudents, updateStudentRegistration, deleteStudent, toggleOfficerRole } from "@/lib/admin.functions";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { Check, X, UserCheck, UserX, Trash2, ShieldCheck, ShieldOff } from "lucide-react";
import { getMyRoles } from "@/lib/queries.server";

export const Route = createFileRoute("/_authenticated/admin/students")({
  head: () => ({ meta: [{ title: "Students — Admin" }] }),
  component: AdminStudents,
});

function AdminStudents() {
  const getStudentsFn = useServerFn(getStudents);
  const updateRegistrationFn = useServerFn(updateStudentRegistration);
  const deleteStudentFn = useServerFn(deleteStudent);
  const toggleOfficerFn = useServerFn(toggleOfficerRole);
  const getRolesFn = useServerFn(getMyRoles);

  const { data: myRoles } = useQuery({
    queryKey: ["my-roles-students-page"],
    queryFn: () => getRolesFn(),
  });
  const isAdmin = myRoles?.includes("admin") ?? false;

  const { data: students, isLoading, refetch } = useQuery({
    queryKey: ["admin-students"],
    queryFn: () => getStudentsFn(),
  });

  async function toggleRegistration(id: string, currentStatus: boolean) {
    try {
      await updateRegistrationFn({ data: { id, is_registered: !currentStatus } });
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
      await deleteStudentFn({ data: { id } });
      toast.success(`Student ${name} deleted successfully.`);
      refetch();
    } catch (e: any) {
      toast.error(e.message || "Failed to delete student.");
    }
  }

  async function handleToggleOfficer(id: string, name: string, isOfficer: boolean) {
    try {
      await toggleOfficerFn({ data: { user_id: id, grant: !isOfficer } });
      toast.success(
        isOfficer ? `Officer role removed from ${name}.` : `${name} is now an Officer.`
      );
      refetch();
    } catch (e: any) {
      toast.error(e.message || "Failed to update officer role.");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="font-display text-3xl">Registered Students</h1>
          <p className="text-muted-foreground">Manage student registration and voting access.</p>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Student ID</th>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Course/Year</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">Loading students...</td>
                </tr>
              ) : students?.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground">No students found.</td>
                </tr>
              ) : (
                students?.map((student: any) => {
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
                        {student.course} {student.year_level ? `- Year ${student.year_level}` : ""}
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
