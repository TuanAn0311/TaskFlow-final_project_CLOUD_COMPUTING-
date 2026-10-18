import { useEffect, useRef, useState } from "react";
import { requestJson } from "../models/apiModel.js";
import { defaultAuthForm, defaultTaskForm } from "../constants/forms.js";
import { taskStatuses } from "../constants/tasks.js";
import WorkspaceView from "../features/workspace/WorkspaceView.jsx";

export default function App() {
    const taskRequestId = useRef(0);
    const teamRequestId = useRef(0);
    const taskDetailsRequestId = useRef(0);
    const [token, setToken] = useState(localStorage.getItem("task-token") || "");
    const [user, setUser] = useState(null);
    const [tasks, setTasks] = useState([]);
    const [team, setTeam] = useState([]);
    const [selectedTask, setSelectedTask] = useState(null);
    const [assignments, setAssignments] = useState([]);
    const [history, setHistory] = useState([]);
    const [comments, setComments] = useState([]);
    const [commentText, setCommentText] = useState("");
    const [editingCommentId, setEditingCommentId] = useState(null);
    const [editingCommentText, setEditingCommentText] = useState("");
    const [assigneeIds, setAssigneeIds] = useState([]);
    const [taskEdit, setTaskEdit] = useState(null);
    const [taskDetailsLoading, setTaskDetailsLoading] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [isRegistering, setIsRegistering] = useState(false);
    const [authForm, setAuthForm] = useState(defaultAuthForm);
    const [taskForm, setTaskForm] = useState(defaultTaskForm);
    const [taskFilters, setTaskFilters] = useState({
        status: "all",
        priority: "all",
        search: "",
        due_after: "",
        due_before: "",
        assignee_id: "",
        created_by: "",
    });
    const [taskPage, setTaskPage] = useState(1);
    const [taskPagination, setTaskPagination] = useState(null);
    const [taskSummary, setTaskSummary] = useState({ todo: 0, in_progress: 0, completed: 0, unassigned: 0 });
    const [tasksLoading, setTasksLoading] = useState(false);
    const [teamSearch, setTeamSearch] = useState("");
    const [teamStatusFilter, setTeamStatusFilter] = useState("all");
    const [teamPage, setTeamPage] = useState(1);
    const [teamPagination, setTeamPagination] = useState(null);
    const [teamLoading, setTeamLoading] = useState(false);
    const [activeTab, setActiveTab] = useState("dashboard");

    const loadTasks = async (authToken = token, page = taskPage) => {
        if (!authToken) return [];

        const requestId = ++taskRequestId.current;
        setTasksLoading(true);
        try {
            const params = new URLSearchParams({ page: String(page), limit: "20" });
            Object.entries(taskFilters).forEach(([key, value]) => {
                if (value && value !== "all") params.set(key, typeof value === "string" ? value.trim() : value);
            });

            const { response, data } = await requestJson(`/api/tasks?${params.toString()}`, { token: authToken });
            if (!response.ok) {
                throw new Error(data.message || "Could not load tasks");
            }

            const nextTasks = Array.isArray(data?.data) ? data.data : [];
            if (requestId === taskRequestId.current) {
                setTasks(nextTasks);
                setTaskPagination(data.pagination || null);
            }
            return nextTasks;
        } finally {
            if (requestId === taskRequestId.current) setTasksLoading(false);
        }
    };

    const loadTaskSummary = async (authToken = token) => {
        if (!authToken) return;

        const results = await Promise.all(taskStatuses.map((status) => requestJson(`/api/tasks?page=1&limit=1&status=${status}`, { token: authToken })));
        const failed = results.find(({ response }) => !response.ok);
        if (failed) throw new Error(failed.data.message || "Could not load task summary");

        const counts = Object.fromEntries(taskStatuses.map((status, index) => [status, Number(results[index].data.pagination?.total) || 0]));
        setTaskSummary(counts);
    };

    const loadUsers = async (authToken = token, role = user?.role, page = teamPage) => {
        if (!authToken || role !== "admin") return [];

        const requestId = ++teamRequestId.current;
        const params = new URLSearchParams({ page: String(page), limit: "20" });
        if (teamSearch.trim()) params.set("search", teamSearch.trim());
        if (teamStatusFilter !== "all") params.set("is_active", String(teamStatusFilter === "active"));
        const { response, data } = await requestJson(`/api/users?${params.toString()}`, { token: authToken });
        if (!response.ok) {
            throw new Error(data.message || "Could not load team");
        }

        const nextUsers = Array.isArray(data?.data) ? data.data : [];
        if (requestId === teamRequestId.current) {
            setTeam(nextUsers);
            setTeamPagination(data.pagination || null);
        }
        return nextUsers;
    };

    const loadTaskDetails = async (task, authToken = token, requestId = ++taskDetailsRequestId.current) => {
        setTaskDetailsLoading(true);
        try {
            const paths = [
                `/api/tasks/${task.id}`,
                `/api/tasks/${task.id}/assignments`,
                `/api/tasks/${task.id}/history`,
                `/api/tasks/${task.id}/comments?page=1&limit=100`,
            ];
            const results = await Promise.all(paths.map((path) => requestJson(path, { token: authToken })));
            if (requestId !== taskDetailsRequestId.current) return;
            const failed = results.find(({ response }) => !response.ok);
            if (failed) {
                throw new Error(failed.data.message || "Could not load task details");
            }

            setSelectedTask(results[0].data.data);
            setAssignments(Array.isArray(results[1].data.data) ? results[1].data.data : []);
            setHistory(Array.isArray(results[2].data.data) ? results[2].data.data : []);
            setComments(Array.isArray(results[3].data.data) ? results[3].data.data : []);
        } finally {
            if (requestId === taskDetailsRequestId.current) setTaskDetailsLoading(false);
        }
    };

    const openTask = async (task) => {
        setSelectedTask(task);
        setAssignments([]);
        setHistory([]);
        setComments([]);
        setAssigneeIds([]);
        setCommentText("");
        setEditingCommentId(null);
        setEditingCommentText("");
        setTaskEdit({
            title: task.title,
            description: task.description || "",
            priority: task.priority,
            due_date: task.due_date ? String(task.due_date).slice(0, 10) : "",
        });
        setActiveTab("detail");
        setError("");
        setSuccess("");
        try {
            await loadTaskDetails(task);
        } catch (err) {
            setError(err.message);
        }
    };

    const loadAccount = async (authToken = token) => {
        if (!authToken) return;

        const { response, data } = await requestJson("/api/auth/me", { token: authToken });
        if (!response.ok) {
            if (response.status === 401) {
                handleLogout();
            }
            throw new Error(data.message || "Failed to load profile");
        }

        const profile = data.data || null;
        setUser(profile);
        await loadTaskSummary(authToken);
    };

    useEffect(() => {
        if (!token) {
            setUser(null);
            setTasks([]);
            return;
        }

        loadAccount(token).catch((err) => setError(err.message));
    }, [token]);

    useEffect(() => {
        if (token && user) {
            const timer = window.setTimeout(
                () => {
                    loadTasks(token).catch((err) => setError(err.message));
                },
                taskFilters.search ? 250 : 0,
            );
            return () => {
                window.clearTimeout(timer);
                taskRequestId.current += 1;
            };
        }
        return undefined;
    }, [taskFilters, taskPage, token, user?.id]);

    useEffect(() => {
        if (!token || user?.role !== "admin") return;

        let isCurrent = true;
        setTeamLoading(true);
        const timer = window.setTimeout(
            () =>
                loadUsers(token, user.role, teamPage)
                    .catch((err) => {
                        if (isCurrent) setError(err.message);
                    })
                    .finally(() => {
                        if (isCurrent) setTeamLoading(false);
                    }),
            teamSearch ? 250 : 0,
        );
        return () => {
            isCurrent = false;
            window.clearTimeout(timer);
            teamRequestId.current += 1;
        };
    }, [teamPage, teamSearch, teamStatusFilter, token, user?.id]);

    const updateTaskFilters = (changes) => {
        setTaskFilters((current) => ({ ...current, ...changes }));
        setTaskPage(1);
    };

    const updateTeamFilters = (changes) => {
        if (changes.search !== undefined) setTeamSearch(changes.search);
        if (changes.status !== undefined) setTeamStatusFilter(changes.status);
        setTeamPage(1);
    };

    const refreshTaskData = async (authToken = token, page = taskPage) => {
        await Promise.all([loadTasks(authToken, page), loadTaskSummary(authToken)]);
    };

    const handleAuthSubmit = async (event) => {
        event.preventDefault();
        setLoading(true);
        setError("");
        setSuccess("");

        try {
            const endpoint = isRegistering ? "/api/auth/register" : "/api/auth/login";
            const payload = isRegistering
                ? {
                      full_name: authForm.full_name,
                      email: authForm.email,
                      password: authForm.password,
                  }
                : {
                      email: authForm.email,
                      password: authForm.password,
                  };

            const { response, data } = await requestJson(endpoint, { method: "POST", body: payload });
            if (!response.ok) {
                throw new Error(data.message || "Authentication failed");
            }

            const authToken = data.data?.token || "";
            if (!authToken) {
                throw new Error("No token returned from server");
            }

            localStorage.setItem("task-token", authToken);
            setToken(authToken);
            setUser(data.data?.user || null);
            setSuccess(isRegistering ? "Registration successful. You are now signed in." : "Logged in successfully.");
            setAuthForm({ ...defaultAuthForm, email: authForm.email });
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateTask = async (event) => {
        event.preventDefault();
        if (!taskForm.title.trim()) {
            setError("Task title is required");
            return;
        }

        setLoading(true);
        setError("");
        setSuccess("");

        try {
            const payload = {
                title: taskForm.title.trim(),
                description: taskForm.description.trim(),
                priority: taskForm.priority,
                due_date: taskForm.due_date || undefined,
            };
            const { response, data } = await requestJson("/api/tasks", {
                token,
                method: "POST",
                body: payload,
            });

            if (!response.ok) {
                throw new Error(data.message || "Could not create task");
            }

            setTaskForm(defaultTaskForm);
            setSuccess("Task created successfully.");
            const resetPage = taskPage !== 1;
            setTaskPage(1);
            await Promise.all([
                loadTaskSummary(token),
                resetPage ? Promise.resolve() : loadTasks(token, 1),
            ]);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateTask = async (event) => {
        event.preventDefault();
        if (!selectedTask || !taskEdit) return;
        setLoading(true);
        setError("");
        setSuccess("");
        try {
            const { response, data } = await requestJson(`/api/tasks/${selectedTask.id}`, {
                token,
                method: "PATCH",
                body: { ...taskEdit, due_date: taskEdit.due_date || null },
            });
            if (!response.ok) throw new Error(data.message || "Could not update task");
            setSelectedTask({ ...selectedTask, ...data.data });
            setSuccess("Task updated successfully.");
            await loadTasks(token);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteTask = async () => {
        if (!selectedTask || !window.confirm(`Delete "${selectedTask.title}"?`)) return;
        setLoading(true);
        setError("");
        setSuccess("");
        try {
            const { response, data } = await requestJson(`/api/tasks/${selectedTask.id}`, {
                token,
                method: "DELETE",
            });
            if (!response.ok) throw new Error(data.message || "Could not delete task");
            setSelectedTask(null);
            setActiveTab("tasks");
            setSuccess("Task deleted successfully.");
            const nextPage = taskPage > 1 && tasks.length === 1 ? taskPage - 1 : taskPage;
            setTaskPage(nextPage);
            await Promise.all([loadTasks(token, nextPage), loadTaskSummary(token)]);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateAssignment = async (assignment, nextStatus) => {
        setLoading(true);
        setError("");
        setSuccess("");
        try {
            const { response, data } = await requestJson(`/api/tasks/${selectedTask.id}/assignments/${assignment.id}/status`, { token, method: "PATCH", body: { status: nextStatus } });
            if (!response.ok) throw new Error(data.message || "Could not update assignment");
            setSuccess(`Assignment moved to ${nextStatus.replace("_", " ")}.`);
            await Promise.all([loadTaskDetails(selectedTask), refreshTaskData(token)]);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAssignUsers = async (event) => {
        event.preventDefault();
        if (!selectedTask || assigneeIds.length === 0) return;
        setLoading(true);
        setError("");
        setSuccess("");
        try {
            const { response, data } = await requestJson(`/api/tasks/${selectedTask.id}/assignments`, {
                token,
                method: "POST",
                body: { assignee_ids: assigneeIds.map(Number) },
            });
            if (!response.ok) throw new Error(data.message || "Could not assign users");
            setAssigneeIds([]);
            setSuccess("Team members assigned successfully.");
            await Promise.all([loadTaskDetails(selectedTask), refreshTaskData(token)]);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRevokeAssignment = async (assignment) => {
        if (!window.confirm(`Remove ${assignment.assignee_name} from this task?`)) return;
        setLoading(true);
        setError("");
        setSuccess("");
        try {
            const { response, data } = await requestJson(`/api/tasks/${selectedTask.id}/assignments/${assignment.id}/revoke`, {
                token,
                method: "PATCH",
                body: { revoke_reason: "Removed by administrator" },
            });
            if (!response.ok) throw new Error(data.message || "Could not remove assignment");
            setSuccess("Assignment removed.");
            await Promise.all([loadTaskDetails(selectedTask), refreshTaskData(token)]);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleAddComment = async (event) => {
        event.preventDefault();
        if (!selectedTask || !commentText.trim()) return;
        setLoading(true);
        setError("");
        setSuccess("");
        try {
            const { response, data } = await requestJson(`/api/tasks/${selectedTask.id}/comments`, {
                token,
                method: "POST",
                body: { content: commentText.trim() },
            });
            if (!response.ok) throw new Error(data.message || "Could not add comment");
            setCommentText("");
            setSuccess("Comment added.");
            await loadTaskDetails(selectedTask);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSaveComment = async (comment) => {
        setLoading(true);
        setError("");
        setSuccess("");
        try {
            const { response, data } = await requestJson(`/api/tasks/${selectedTask.id}/comments/${comment.id}`, {
                token,
                method: "PATCH",
                body: { content: editingCommentText.trim() },
            });
            if (!response.ok) throw new Error(data.message || "Could not update comment");
            setEditingCommentId(null);
            setEditingCommentText("");
            setSuccess("Comment updated.");
            await loadTaskDetails(selectedTask);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteComment = async (comment) => {
        if (!window.confirm("Delete this comment?")) return;
        setLoading(true);
        setError("");
        setSuccess("");
        try {
            const { response, data } = await requestJson(`/api/tasks/${selectedTask.id}/comments/${comment.id}`, {
                token,
                method: "DELETE",
            });
            if (!response.ok) throw new Error(data.message || "Could not delete comment");
            setSuccess("Comment deleted.");
            await loadTaskDetails(selectedTask);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleToggleUserStatus = async (member) => {
        setLoading(true);
        setError("");
        setSuccess("");
        try {
            const { response, data } = await requestJson(`/api/users/${member.id}/status`, {
                token,
                method: "PATCH",
                body: { is_active: !member.is_active },
            });
            if (!response.ok) throw new Error(data.message || "Could not update member status");
            setSuccess(`${member.full_name} is now ${data.data.is_active ? "active" : "inactive"}.`);
            await loadUsers(token, user.role, teamPage);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        taskRequestId.current += 1;
        teamRequestId.current += 1;
        taskDetailsRequestId.current += 1;
        setTaskDetailsLoading(false);
        localStorage.removeItem("task-token");
        setToken("");
        setUser(null);
        setTasks([]);
        setTeam([]);
        setSelectedTask(null);
        setAssignments([]);
        setHistory([]);
        setComments([]);
        setTaskEdit(null);
        setTaskPagination(null);
        setTeamPagination(null);
        setTaskSummary({ todo: 0, in_progress: 0, completed: 0, unassigned: 0 });
        setTaskForm(defaultTaskForm);
        setAssigneeIds([]);
        setCommentText("");
        setEditingCommentId(null);
        setEditingCommentText("");
        setError("");
        setSuccess("");
        setActiveTab("dashboard");
    };

    return (
        <WorkspaceView
            activeTab={activeTab}
            assignments={assignments}
            assigneeIds={assigneeIds}
            authForm={authForm}
            comments={comments}
            commentText={commentText}
            editingCommentId={editingCommentId}
            editingCommentText={editingCommentText}
            error={error}
            handleAddComment={handleAddComment}
            handleAssignUsers={handleAssignUsers}
            handleAuthSubmit={handleAuthSubmit}
            handleCreateTask={handleCreateTask}
            handleDeleteComment={handleDeleteComment}
            handleDeleteTask={handleDeleteTask}
            handleRevokeAssignment={handleRevokeAssignment}
            handleSaveComment={handleSaveComment}
            handleToggleUserStatus={handleToggleUserStatus}
            handleUpdateAssignment={handleUpdateAssignment}
            handleUpdateTask={handleUpdateTask}
            history={history}
            isRegistering={isRegistering}
            loading={loading}
            taskDetailsLoading={taskDetailsLoading}
            onAssigneeIdsChange={setAssigneeIds}
            onBack={() => setActiveTab("tasks")}
            onChangeAuthForm={setAuthForm}
            onChangeCommentText={setCommentText}
            onChangeEditingCommentText={setEditingCommentText}
            onChangeTaskEdit={setTaskEdit}
            onChangeTaskFilters={updateTaskFilters}
            onChangeTaskForm={setTaskForm}
            onChangeTeamSearch={(search) => updateTeamFilters({ search })}
            onChangeTeamStatus={(status) => updateTeamFilters({ status })}
            onLogout={handleLogout}
            onOpenTask={openTask}
            onPageChangeTask={setTaskPage}
            onPageChangeTeam={setTeamPage}
            onTabChange={setActiveTab}
            onToggleRegistration={() => {
                setIsRegistering((current) => !current);
                setError("");
                setSuccess("");
            }}
            pageDataTask={taskPagination}
            pageDataTeam={teamPagination}
            searchTeam={teamSearch}
            selectedTask={selectedTask}
            setEditingCommentId={setEditingCommentId}
            statusFilterTeam={teamStatusFilter}
            success={success}
            taskEdit={taskEdit}
            taskFilters={taskFilters}
            taskForm={taskForm}
            taskSummary={taskSummary}
            tasks={tasks}
            tasksLoading={tasksLoading}
            team={team}
            teamLoading={teamLoading}
            user={user}
        />
    );
}
