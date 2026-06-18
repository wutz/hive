#!/bin/bash
#
# Hive Agent Watcher
#
# Continuously watches for new user messages in Hive and triggers Claude Code to respond.
# Run this in the background to keep the agent always-on.
#
# Usage:
#   cd ~/Projects/wutz/hive && ./mcp/hive-agent.sh
#

HIVE_URL="https://hive.wutz.workers.dev"
HIVE_API_KEY="hive_agent_xy_P69QjOJ3hNb2_7RDXsmSwSyBOSDgd"
LAST_CHECK_FILE="/tmp/hive-last-check.txt"

# Initialize last check time
if [ ! -f "$LAST_CHECK_FILE" ]; then
  date -u +%Y-%m-%dT%H:%M:%SZ > "$LAST_CHECK_FILE"
fi

echo "[Hive Agent] Started — watching for new messages..."

while true; do
  LAST_CHECK=$(cat "$LAST_CHECK_FILE")

  # Get all chats
  CHATS=$(curl -s -H "User-Agent: hive-agent" "$HIVE_URL/api/tasks" 2>/dev/null)

  if [ -z "$CHATS" ] || [ "$CHATS" = "error code: 1101" ]; then
    sleep 5
    continue
  fi

  # Use Claude Code to check and respond to new messages
  # Only run if there are new messages since last check
  RESPONSE=$(claude --print "You are a Hive agent. Check for chats with unanswered user messages using hive_list_chats and hive_get_chat_events. Only respond to chats where the last message is from a human (userType='human') and there's no agent reply after it. Use hive_respond to reply. Be concise and helpful. Skip chats that already have an agent response as the last message." 2>/dev/null)

  if [ -n "$RESPONSE" ] && [ "$RESPONSE" != "No new messages to respond to." ]; then
    echo "[$(date '+%H:%M:%S')] Agent responded:"
    echo "$RESPONSE" | head -5
    echo "---"
  fi

  # Update last check time
  date -u +%Y-%m-%dT%H:%M:%SZ > "$LAST_CHECK_FILE"

  # Wait before next check
  sleep 15
done
