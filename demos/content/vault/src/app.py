from dataclasses import dataclass


@dataclass
class Task:
    title: str
    done: bool = False


def pending(tasks: list[Task]) -> list[Task]:
    """Return the tasks that are still open."""
    return [task for task in tasks if not task.done]


if __name__ == "__main__":
    print(pending([Task("כתיבה"), Task("עריכה", done=True)]))
