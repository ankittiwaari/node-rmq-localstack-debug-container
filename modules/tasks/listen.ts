import TaskWorkers from "../workers/task-queue-workers"

(async() => {
    await TaskWorkers.consumeTasks()
})()