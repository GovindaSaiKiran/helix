import { IntentRouter, ParsedActionItem, ExtractedParameters, AgentIntent } from './intentRouter';
import { AuthGuard, AUTH_REQUIRED_MESSAGE } from '../authGuard';
import { TaskService } from '../taskService';
import { ProjectService } from '../projectService';
import { SubjectService } from '../subjectService';
import { YouTubeService, YouTubeVideo } from '../youtubeService';
import { firebaseMessaging } from '../firebaseMessaging';
import { AiService } from '../aiService';
import { Task, Project, ScheduleSlot } from '../../types';

export interface ToolExecutionTrace {
  toolName: string;
  parameters: Record<string, any>;
  status: 'success' | 'failed' | 'auth_blocked' | 'pending_confirmation' | 'unimplemented';
  resultSummary?: string;
  error?: string;
}

export interface AgentExecutionResult {
  reply: string;
  toolResults: Array<{
    type: 'task_created' | 'task_updated' | 'task_deleted' | 'tasks_listed' | 'videos_found' | 'project_created' | 'project_updated' | 'project_deleted' | 'subject_created' | 'subject_deleted' | 'navigation' | 'info' | 'confirmation_required' | 'auth_required' | 'notification_status';
    data?: any;
    videos?: YouTubeVideo[];
    confirmationPayload?: {
      action: 'delete_task' | 'delete_project' | 'delete_subject';
      targetId: string;
      targetTitle: string;
    };
  }>;
  trace: {
    userCommand: string;
    intents: string[];
    extractedParameters: ExtractedParameters[];
    toolsExecuted: ToolExecutionTrace[];
    finalResponse: string;
    timestamp: string;
  };
}

export class AgentExecutor {
  /**
   * Main Execution Pipeline:
   * USER COMMAND → INTENT ROUTER → AUTH GUARD → SERVICE EXECUTOR → OBSERVABLE RESULT
   */
  public static async execute(
    userPrompt: string,
    options?: {
      confirmedAction?: { action: string; targetId: string };
      activeUserId?: string;
    }
  ): Promise<AgentExecutionResult> {
    const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const toolsExecuted: ToolExecutionTrace[] = [];
    const toolResults: AgentExecutionResult['toolResults'] = [];
    const summaryReplies: string[] = [];

    // 1. Check Handle Direct Confirmed Destructive Action
    if (options?.confirmedAction) {
      const auth = await AuthGuard.checkAuth();
      const confirmedUserId = auth.userId || options.activeUserId;
      if (!auth.isAuthenticated || !confirmedUserId || confirmedUserId.startsWith('usr_local')) {
        return this.createAuthRequiredResponse(userPrompt, timestamp);
      }
      return this.executeConfirmedDestructiveAction(options.confirmedAction, confirmedUserId, userPrompt, timestamp);
    }

    // 2. Parse Intent & Extract Parameters
    const parsedActions = IntentRouter.parse(userPrompt);

    if (parsedActions.length === 0) {
      return {
        reply: "I couldn't identify a specific action in your request. Try asking me to schedule a task, set a reminder, or search for a study lecture!",
        toolResults: [],
        trace: {
          userCommand: userPrompt,
          intents: ['UNKNOWN'],
          extractedParameters: [],
          toolsExecuted: [],
          finalResponse: "No actionable intent identified.",
          timestamp,
        },
      };
    }

    // 3. Process Each Action in Sequence (Supports Multi-Action Commands)
    for (const actionItem of parsedActions) {
      const { intent, parameters, requiresConfirmation } = actionItem;

      // Check Authentication for Protected Capabilities
      const auth = await AuthGuard.checkAuth();
      const authenticatedUserId = auth.userId || (options?.activeUserId && !options.activeUserId.startsWith('usr_local') ? options.activeUserId : null);

      if (!this.isPublicIntent(intent) && (!auth.isAuthenticated || !authenticatedUserId)) {
        toolsExecuted.push({
          toolName: intent,
          parameters,
          status: 'auth_blocked',
          error: AUTH_REQUIRED_MESSAGE,
        });

        toolResults.push({
          type: 'auth_required',
          data: { message: AUTH_REQUIRED_MESSAGE },
        });

        return {
          reply: AUTH_REQUIRED_MESSAGE,
          toolResults,
          trace: {
            userCommand: userPrompt,
            intents: parsedActions.map(a => a.intent),
            extractedParameters: parsedActions.map(a => a.parameters),
            toolsExecuted,
            finalResponse: AUTH_REQUIRED_MESSAGE,
            timestamp,
          },
        };
      }

      // Guard: Check if the user is missing required parameters (Title or Time)
      if (parameters.missingRequired && parameters.missingRequired.length > 0) {
        if (parameters.missingRequired.includes('title')) {
          summaryReplies.push("What is the title or subject of the task you'd like to schedule?");
          continue;
        }
        if (parameters.missingRequired.includes('time')) {
          summaryReplies.push(`What time would you like me to set the reminder for "${parameters.title || 'this task'}"?`);
          continue;
        }
      }

      const realUserId = authenticatedUserId!;

      // 4. Dispatch to Authoritative Service Operation
      try {
        switch (intent) {
          // --- TASKS & REMINDERS ---
          case 'CREATE_TASK':
          case 'CREATE_REMINDER': {
            const taskData = await this.handleCreateTask(realUserId, parameters);
            if (taskData) {
              toolResults.push({ type: 'task_created', data: taskData });
              toolsExecuted.push({
                toolName: 'TaskService.createTask',
                parameters: { title: taskData.title, scheduledDate: taskData.scheduledDate, startTime: taskData.scheduledStartTime, endTime: taskData.scheduledEndTime },
                status: 'success',
                resultSummary: `Created task "${taskData.title}" in database.`,
              });

              const timeStr = taskData.scheduledStartTime
                ? ` from ${this.formatDisplayTime(taskData.scheduledStartTime)} to ${this.formatDisplayTime(taskData.scheduledEndTime || '')}`
                : '';
              const dateStr = taskData.scheduledDate === new Date().toISOString().split('T')[0]
                ? 'today'
                : taskData.scheduledDate === this.getTomorrowDate()
                ? 'tomorrow'
                : `on ${taskData.scheduledDate}`;
              
              if (parameters.reminder || intent === 'CREATE_REMINDER') {
                summaryReplies.push(`Done. I've scheduled "${taskData.title}" for ${dateStr}${timeStr} and configured a reminder.`);
              } else {
                summaryReplies.push(`Done. I've scheduled "${taskData.title}" for ${dateStr}${timeStr}.`);
              }
            } else {
              throw new Error('Database operation failed to persist task.');
            }
            break;
          }

          case 'COMPLETE_TASK':
          case 'UPDATE_TASK': {
            const targetTitle = parameters.targetTitle || parameters.title || '';
            const allTasks = await TaskService.getTasks(realUserId);
            const matchingTask = this.findBestMatchingTask(allTasks, targetTitle);

            if (matchingTask) {
              await TaskService.updateTaskStatus(matchingTask.id, 'completed', 100);
              toolResults.push({ type: 'task_updated', data: { ...matchingTask, status: 'completed' } });
              toolsExecuted.push({
                toolName: 'TaskService.updateTaskStatus',
                parameters: { taskId: matchingTask.id, status: 'completed' },
                status: 'success',
                resultSummary: `Marked task "${matchingTask.title}" as completed.`,
              });
              summaryReplies.push(`Marked "${matchingTask.title}" as completed! Great progress! 🎉`);
            } else {
              summaryReplies.push(`I couldn't find a task matching "${targetTitle}". Please check your tasks in the Today timetable.`);
              toolsExecuted.push({
                toolName: 'TaskService.updateTaskStatus',
                parameters: { targetTitle },
                status: 'failed',
                error: 'Task not found',
              });
            }
            break;
          }

          case 'DELETE_TASK':
          case 'DELETE_REMINDER': {
            const targetTitle = parameters.targetTitle || parameters.title || '';
            const allTasks = await TaskService.getTasks(realUserId);
            const matchingTask = this.findBestMatchingTask(allTasks, targetTitle);

            if (matchingTask) {
              if (requiresConfirmation) {
                toolResults.push({
                  type: 'confirmation_required',
                  confirmationPayload: {
                    action: 'delete_task',
                    targetId: matchingTask.id,
                    targetTitle: matchingTask.title,
                  },
                });
                toolsExecuted.push({
                  toolName: 'TaskService.deleteTask',
                  parameters: { targetId: matchingTask.id },
                  status: 'pending_confirmation',
                  resultSummary: `Awaiting confirmation to delete "${matchingTask.title}".`,
                });
                summaryReplies.push(`Are you sure you want to permanently delete the task "${matchingTask.title}"?`);
              } else {
                await TaskService.deleteTask(matchingTask.id);
                toolResults.push({ type: 'task_deleted', data: matchingTask });
                summaryReplies.push(`Deleted task "${matchingTask.title}".`);
              }
            } else {
              summaryReplies.push(`I couldn't find a task named "${targetTitle}" to delete.`);
            }
            break;
          }

          case 'LIST_TASKS':
          case 'GET_TODAY_TASKS':
          case 'GET_UPCOMING_TASKS':
          case 'LIST_REMINDERS': {
            const tasks = await TaskService.getTasks(realUserId);
            const today = new Date().toISOString().split('T')[0];
            const filtered = intent === 'GET_TODAY_TASKS'
              ? tasks.filter(t => t.scheduledDate === today)
              : intent === 'GET_UPCOMING_TASKS'
              ? tasks.filter(t => t.scheduledDate && t.scheduledDate >= today)
              : intent === 'LIST_REMINDERS'
              ? tasks.filter(t => t.scheduledStartTime && t.status !== 'completed')
              : tasks;

            toolResults.push({ type: 'tasks_listed', data: filtered });
            toolsExecuted.push({
              toolName: 'TaskService.getTasks',
              parameters: { filter: intent },
              status: 'success',
              resultSummary: `Retrieved ${filtered.length} tasks.`,
            });

            if (filtered.length === 0) {
              const label = intent === 'LIST_REMINDERS' ? 'active reminders' : intent === 'GET_TODAY_TASKS' ? 'tasks scheduled for today' : 'active tasks';
              summaryReplies.push(`You have no ${label}. Enjoy your focus time!`);
            } else {
              const taskBulletList = filtered.slice(0, 5).map(t => `• ${t.title} (${t.scheduledStartTime || 'Flexible'} - ${t.status})`).join('\n');
              const label = intent === 'LIST_REMINDERS' ? 'scheduled reminders' : intent === 'GET_TODAY_TASKS' ? 'tasks for today' : 'active tasks';
              summaryReplies.push(`Here are your ${label}:\n${taskBulletList}${filtered.length > 5 ? `\n...and ${filtered.length - 5} more.` : ''}`);
            }
            break;
          }

          case 'UPDATE_REMINDER': {
            const targetTitle = parameters.targetTitle || parameters.title || '';
            const allTasks = await TaskService.getTasks(realUserId);
            const matches = this.findMatchingTasks(allTasks, targetTitle);

            if (matches.length === 0) {
              summaryReplies.push(`I couldn't find a task matching "${targetTitle}". Please check your tasks in the Today timetable.`);
              toolsExecuted.push({
                toolName: 'TaskService.updateTask',
                parameters: { targetTitle },
                status: 'failed',
                error: 'Task not found',
              });
              break;
            }

            if (matches.length > 1) {
              const taskOptions = matches.slice(0, 4).map(t => `"${t.title}" (${t.scheduledDate || 'No date'} ${t.scheduledStartTime ? this.formatDisplayTime(t.scheduledStartTime) : ''})`).join(', ');
              summaryReplies.push(`I found multiple tasks matching "${targetTitle}": ${taskOptions}. Which one would you like to update?`);
              toolsExecuted.push({
                toolName: 'TaskService.updateTask',
                parameters: { targetTitle, matchesCount: matches.length },
                status: 'pending_confirmation',
                resultSummary: `Ambiguous match with ${matches.length} candidates.`,
              });
              break;
            }

            const matchingTask = matches[0];

            // Check if user provided new time or new date
            const newDate = parameters.date || matchingTask.scheduledDate;
            const newStartTime = parameters.startTime || matchingTask.scheduledStartTime;
            const newEndTime = parameters.endTime || (newStartTime && matchingTask.estimatedMinutes ? this.addMinutesToTime(newStartTime, matchingTask.estimatedMinutes) : matchingTask.scheduledEndTime);

            if (!parameters.startTime && !parameters.date) {
              summaryReplies.push(`What new time or date would you like to reschedule "${matchingTask.title}" to?`);
              break;
            }

            const updates: Partial<Task> = {};
            if (newDate) updates.scheduledDate = newDate;
            if (newStartTime) updates.scheduledStartTime = newStartTime;
            if (newEndTime) updates.scheduledEndTime = newEndTime;

            await TaskService.updateTask(matchingTask.id, updates);

            const updatedTaskData = { ...matchingTask, ...updates };
            toolResults.push({ type: 'task_updated', data: updatedTaskData });
            toolsExecuted.push({
              toolName: 'TaskService.updateTask',
              parameters: { taskId: matchingTask.id, ...updates },
              status: 'success',
              resultSummary: `Updated reminder/schedule for "${matchingTask.title}".`,
            });

            const timeStr = newStartTime ? ` at ${this.formatDisplayTime(newStartTime)}` : '';
            const dateStr = newDate === new Date().toISOString().split('T')[0]
              ? 'today'
              : newDate === this.getTomorrowDate()
              ? 'tomorrow'
              : `on ${newDate}`;

            summaryReplies.push(`Done. I've updated the reminder for "${matchingTask.title}" to ${dateStr}${timeStr}.`);
            break;
          }

          // --- SCHEDULE & TIMETABLE ---
          case 'CREATE_SCHEDULE':
          case 'UPDATE_SCHEDULE':
          case 'DELETE_SCHEDULE':
          case 'GENERATE_TIMETABLE':
          case 'REPLAN': {
            toolResults.push({ type: 'navigation', data: { page: '/today' } });
            toolsExecuted.push({
              toolName: 'ScheduleService.navigate',
              parameters: { intent },
              status: 'success',
            });
            summaryReplies.push("Opening your interactive timetable and schedule planner...");
            break;
          }

          // --- PROJECTS ---
          case 'CREATE_PROJECT': {
            const newProj = await ProjectService.createProject(realUserId, {
              title: parameters.title || 'Coursework Project',
              category: 'project',
              priority: parameters.priority || 'medium',
              status: 'pending',
              progress: 0,
              estimatedEffortHours: 10,
              remainingEffortHours: 10,
              dueDate: parameters.date || 'Next Week',
              dependencies: [],
              modules: [],
            });

            if (newProj) {
              toolResults.push({ type: 'project_created', data: newProj });
              toolsExecuted.push({
                toolName: 'ProjectService.createProject',
                parameters: { title: newProj.title },
                status: 'success',
                resultSummary: `Created project "${newProj.title}".`,
              });
              summaryReplies.push(`Created project "${newProj.title}" in your Work hub.`);
            }
            break;
          }

          case 'ADD_MILESTONE':
          case 'UPDATE_PROJECT':
          case 'GET_PROJECT_STATUS': {
            const projects = await ProjectService.getProjects(realUserId);
            toolResults.push({ type: 'navigation', data: { page: '/work' } });
            toolsExecuted.push({
              toolName: 'ProjectService.getProjects',
              parameters: { count: projects.length },
              status: 'success',
            });
            if (projects.length === 0) {
              summaryReplies.push("You have no active projects. You can ask me to create one!");
            } else {
              const list = projects.slice(0, 3).map(p => `• ${p.title} (${p.progress}% completed)`).join('\n');
              summaryReplies.push(`Here is your current project status:\n${list}`);
            }
            break;
          }

          case 'DELETE_PROJECT': {
            const targetTitle = parameters.targetTitle || parameters.title || '';
            const allProjects = await ProjectService.getProjects(realUserId);
            const match = allProjects.find(p => p.title.toLowerCase().includes(targetTitle.toLowerCase()));

            if (match) {
              if (requiresConfirmation) {
                toolResults.push({
                  type: 'confirmation_required',
                  confirmationPayload: { action: 'delete_project', targetId: match.id, targetTitle: match.title },
                });
                toolsExecuted.push({
                  toolName: 'ProjectService.deleteProject',
                  parameters: { targetId: match.id },
                  status: 'pending_confirmation',
                });
                summaryReplies.push(`Are you sure you want to permanently delete the project "${match.title}"?`);
              } else {
                await ProjectService.deleteProject(match.id);
                toolResults.push({ type: 'project_deleted', data: match });
                summaryReplies.push(`Deleted project "${match.title}".`);
              }
            } else {
              summaryReplies.push(`I couldn't find a project named "${targetTitle}".`);
            }
            break;
          }

          // --- STUDY & SUBJECTS ---
          case 'ADD_SUBJECT': {
            const name = parameters.title || parameters.subjectName || 'New Subject';
            const subject = await SubjectService.createSubject(realUserId, {
              name,
              code: '',
              color: '#6366F1',
              priority: 'medium',
              totalUnits: 0,
              completedUnits: 0,
              syllabusCoverage: 0,
            });
            if (subject) {
              toolResults.push({ type: 'subject_created', data: subject });
              toolsExecuted.push({
                toolName: 'SubjectService.createSubject',
                parameters: { name },
                status: 'success',
              });
              summaryReplies.push(`Enrolled you in "${subject.name}".`);
            }
            break;
          }

          case 'DELETE_SUBJECT': {
            const targetTitle = parameters.targetTitle || parameters.title || '';
            const allSubjects = await SubjectService.getSubjects(realUserId);
            const match = allSubjects.find(s => s.name.toLowerCase().includes(targetTitle.toLowerCase()));

            if (match) {
              if (requiresConfirmation) {
                toolResults.push({
                  type: 'confirmation_required',
                  confirmationPayload: { action: 'delete_subject', targetId: match.id, targetTitle: match.name },
                });
                toolsExecuted.push({
                  toolName: 'SubjectService.deleteSubject',
                  parameters: { targetId: match.id },
                  status: 'pending_confirmation',
                });
                summaryReplies.push(`Are you sure you want to remove the subject "${match.name}"?`);
              } else {
                await SubjectService.deleteSubject(match.id);
                toolResults.push({ type: 'subject_deleted', data: match });
                summaryReplies.push(`Removed subject "${match.name}".`);
              }
            } else {
              summaryReplies.push(`I couldn't find a subject named "${targetTitle}".`);
            }
            break;
          }

          case 'ADD_TOPIC':
          case 'EXTRACT_SYLLABUS': {
            toolResults.push({ type: 'navigation', data: { page: '/study' } });
            summaryReplies.push("Opening your Study Hub where you can upload syllabus documents and manage topics.");
            break;
          }

          case 'GENERATE_TOPIC_CONTENT':
          case 'EXPLAIN_TOPIC':
          case 'SUMMARIZE':
          case 'ANSWER_QUESTION': {
            const topic = parameters.title || parameters.query || userPrompt;
            const content = await AiService.generateTopicStudyContent(topic);
            toolResults.push({ type: 'info', data: content });
            toolsExecuted.push({
              toolName: 'AiService.generateTopicStudyContent',
              parameters: { topic },
              status: 'success',
            });
            summaryReplies.push(`**${content.topicTitle}**\n\n${content.simplifiedExplanation}\n\n• ${content.keyPoints.slice(0, 3).join('\n• ')}`);
            break;
          }

          case 'GENERATE_QUIZ': {
            const topic = parameters.title || parameters.subjectName || 'General Studies';
            toolResults.push({ type: 'navigation', data: { page: '/study' } });
            summaryReplies.push(`Opening study quiz generator for "${topic}" in your Study Hub...`);
            break;
          }

          // --- NOTIFICATIONS & FCM ---
          case 'ENABLE_NOTIFICATIONS': {
            const res = await firebaseMessaging.enableNotifications(realUserId);
            toolResults.push({ type: 'notification_status', data: res });
            toolsExecuted.push({ toolName: 'firebaseMessaging.enableNotifications', parameters: {}, status: res.success ? 'success' : 'failed' });
            summaryReplies.push(res.success ? "Browser push notifications enabled successfully!" : `Could not enable notifications: ${res.error}`);
            break;
          }

          case 'DISABLE_NOTIFICATIONS': {
            const res = await firebaseMessaging.disableNotifications(realUserId);
            toolResults.push({ type: 'notification_status', data: res });
            toolsExecuted.push({ toolName: 'firebaseMessaging.disableNotifications', parameters: {}, status: 'success' });
            summaryReplies.push("Browser push notifications disabled.");
            break;
          }

          case 'SEND_TEST_NOTIFICATION': {
            const res = await firebaseMessaging.sendTestNotification(realUserId);
            toolResults.push({ type: 'notification_status', data: res });
            toolsExecuted.push({ toolName: 'firebaseMessaging.sendTestNotification', parameters: {}, status: res.success ? 'success' : 'failed' });
            summaryReplies.push(res.success ? "Test push notification dispatched to your browser!" : `Test notification failed: ${res.error}`);
            break;
          }

          // --- SEARCH ---
          case 'SEARCH_YOUTUBE': {
            const query = parameters.query || 'Computer Science Tutorial';
            const videos = await YouTubeService.searchStudyVideos(query, 3);
            
            toolResults.push({
              type: 'videos_found',
              data: { query },
              videos,
            });

            toolsExecuted.push({
              toolName: 'YouTubeService.searchStudyVideos',
              parameters: { query, maxResults: 3 },
              status: 'success',
              resultSummary: `Found ${videos.length} YouTube study lectures for "${query}".`,
            });

            summaryReplies.push(`Found ${videos.length} YouTube lectures for "${query}".`);
            break;
          }

          // --- NAVIGATION ---
          case 'SHOW_TODAY':
          case 'SHOW_WEEK':
          case 'SHOW_ANALYTICS':
          case 'SHOW_PROJECTS':
          case 'SHOW_TASKS': {
            const page = parameters.page || '/today';
            toolResults.push({ type: 'navigation', data: { page } });
            toolsExecuted.push({
              toolName: 'Navigate',
              parameters: { page },
              status: 'success',
            });
            summaryReplies.push(`Navigating to ${page}...`);
            break;
          }

          case 'GREETING': {
            summaryReplies.push("Hello! 👋 I'm Helix, your intelligent study assistant. I can schedule focus sessions, set reminder alerts, find YouTube lecture tutorials, and organize coursework projects. How can I help you today?");
            break;
          }

          case 'HELP': {
            summaryReplies.push("Here are some things I can do for you:\n\n📅 **Schedule Tasks & Reminders**: *\"Schedule Video editing class from 8pm to 9pm today\"*\n🔔 **Manage Reminders**: *\"Reschedule video editing class to 9pm\"*\n🎥 **Find Video Lectures**: *\"Find a YouTube tutorial about React hooks\"*\n📁 **Create Projects**: *\"Create project called DBMS Final Project\"*\n📊 **Timetable & Agenda**: *\"What tasks do I have today?\"*");
            break;
          }

          case 'UNKNOWN':
          default: {
            toolsExecuted.push({
              toolName: 'UnrecognizedIntent',
              parameters: { intent },
              status: 'unimplemented',
            });
            summaryReplies.push(`I analyzed your request: "${userPrompt}". You can ask me to schedule a class, set a reminder, search YouTube lectures, or manage coursework projects!`);
          }
        }
      } catch (err: any) {
        console.error(`[AgentExecutor] Error executing ${intent}:`, err);
        toolsExecuted.push({
          toolName: intent,
          parameters,
          status: 'failed',
          error: err.message,
        });
        summaryReplies.push(`I couldn't complete that action because the request failed: ${err.message}.`);
      }
    }

    const finalResponse = summaryReplies.join('\n\n');

    return {
      reply: finalResponse,
      toolResults,
      trace: {
        userCommand: userPrompt,
        intents: parsedActions.map(a => a.intent),
        extractedParameters: parsedActions.map(a => a.parameters),
        toolsExecuted,
        finalResponse,
        timestamp,
      },
    };
  }

  /**
   * Execute verified destructive action after user confirmation.
   */
  private static async executeConfirmedDestructiveAction(
    confirmed: { action: string; targetId: string },
    userId: string,
    userCommand: string,
    timestamp: string
  ): Promise<AgentExecutionResult> {
    if (confirmed.action === 'delete_task') {
      await TaskService.deleteTask(confirmed.targetId);
      return {
        reply: "Task permanently deleted.",
        toolResults: [{ type: 'task_deleted', data: { id: confirmed.targetId } }],
        trace: {
          userCommand,
          intents: ['DELETE_TASK_CONFIRMED'],
          extractedParameters: [{ taskId: confirmed.targetId, rawInput: userCommand }],
          toolsExecuted: [{ toolName: 'TaskService.deleteTask', parameters: { id: confirmed.targetId }, status: 'success' }],
          finalResponse: "Task permanently deleted.",
          timestamp,
        },
      };
    }

    if (confirmed.action === 'delete_project') {
      await ProjectService.deleteProject(confirmed.targetId);
      return {
        reply: "Project permanently deleted.",
        toolResults: [{ type: 'project_deleted', data: { id: confirmed.targetId } }],
        trace: {
          userCommand,
          intents: ['DELETE_PROJECT_CONFIRMED'],
          extractedParameters: [{ taskId: confirmed.targetId, rawInput: userCommand }],
          toolsExecuted: [{ toolName: 'ProjectService.deleteProject', parameters: { id: confirmed.targetId }, status: 'success' }],
          finalResponse: "Project permanently deleted.",
          timestamp,
        },
      };
    }

    if (confirmed.action === 'delete_subject') {
      await SubjectService.deleteSubject(confirmed.targetId);
      return {
        reply: "Subject permanently removed.",
        toolResults: [{ type: 'subject_deleted', data: { id: confirmed.targetId } }],
        trace: {
          userCommand,
          intents: ['DELETE_SUBJECT_CONFIRMED'],
          extractedParameters: [{ taskId: confirmed.targetId, rawInput: userCommand }],
          toolsExecuted: [{ toolName: 'SubjectService.deleteSubject', parameters: { id: confirmed.targetId }, status: 'success' }],
          finalResponse: "Subject permanently removed.",
          timestamp,
        },
      };
    }

    return {
      reply: "Action completed.",
      toolResults: [],
      trace: {
        userCommand,
        intents: ['CONFIRMED_ACTION'],
        extractedParameters: [],
        toolsExecuted: [],
        finalResponse: "Action completed.",
        timestamp,
      },
    };
  }

  private static async handleCreateTask(userId: string, params: ExtractedParameters): Promise<Task | null> {
    const scheduledDate = params.date || new Date().toISOString().split('T')[0];
    const estimatedMinutes = params.estimatedMinutes || 45;

    const newTask = await TaskService.createTask(userId, {
      title: params.title || 'Focus Session',
      scheduledDate,
      scheduledStartTime: params.startTime, // Only set if user explicitly provided a time
      scheduledEndTime: params.endTime,
      estimatedMinutes,
      priority: params.priority || 'medium',
      type: params.type || 'study',
      status: 'pending',
      progress: 0,
    });

    return newTask;
  }

  private static isPublicIntent(intent: string): boolean {
    const publicIntents = ['GREETING', 'HELP', 'SHOW_TODAY', 'SHOW_WEEK', 'SHOW_ANALYTICS', 'SHOW_TASKS', 'SHOW_PROJECTS'];
    return publicIntents.includes(intent);
  }

  private static findMatchingTasks(tasks: Task[], targetTitle: string): Task[] {
    if (!targetTitle) return [];
    const cleanTarget = targetTitle.toLowerCase().trim();

    // 1. Exact matches
    const exactMatches = tasks.filter(t => t.title.toLowerCase() === cleanTarget);
    if (exactMatches.length > 0) return exactMatches;

    // 2. Partial substring matches
    const partialMatches = tasks.filter(t => t.title.toLowerCase().includes(cleanTarget) || cleanTarget.includes(t.title.toLowerCase()));
    return partialMatches;
  }

  private static addMinutesToTime(start: string, mins: number): string {
    const [sh, sm] = start.split(':').map(Number);
    const totalMins = (sh * 60 + sm + mins) % (24 * 60);
    const eh = Math.floor(totalMins / 60);
    const em = totalMins % 60;
    return `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
  }

  private static findBestMatchingTask(tasks: Task[], targetTitle: string): Task | null {
    const matches = this.findMatchingTasks(tasks, targetTitle);
    return matches[0] || null;
  }

  private static createAuthRequiredResponse(userPrompt: string, timestamp: string): AgentExecutionResult {
    return {
      reply: AUTH_REQUIRED_MESSAGE,
      toolResults: [{ type: 'auth_required', data: { message: AUTH_REQUIRED_MESSAGE } }],
      trace: {
        userCommand: userPrompt,
        intents: ['AUTH_REQUIRED'],
        extractedParameters: [],
        toolsExecuted: [{ toolName: 'AuthGuard', parameters: {}, status: 'auth_blocked', error: AUTH_REQUIRED_MESSAGE }],
        finalResponse: AUTH_REQUIRED_MESSAGE,
        timestamp,
      },
    };
  }

  private static formatDisplayTime(time24: string): string {
    if (!time24) return '';
    const [hStr, mStr] = time24.split(':');
    let h = parseInt(hStr, 10);
    const m = mStr || '00';
    if (isNaN(h)) return time24;
    const ampm = h >= 12 ? 'PM' : 'AM';
    if (h > 12) h -= 12;
    if (h === 0) h = 12;
    return `${h}:${m} ${ampm}`;
  }

  private static getTomorrowDate(): string {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  }
}
