#!/usr/bin/env bash
# List MyCourseVille assignments with their exact due dates.
#
# Usage:
#   export MCV_COOKIES='has_js=1; SESS...=...; XSRF-TOKEN=...; laravel_session=...'
#   ./mcv_due.sh                  # upcoming assignments in this semester's courses
#   ./mcv_due.sh -t               # only upcoming ones you haven't submitted
#   ./mcv_due.sh -a               # everything, including past due dates
#   ./mcv_due.sh 81802 89470      # only these courses (cv_cid from the course URL)
#   ./mcv_due.sh -p               # machine-readable: epoch, course, status, title, url (tab-separated)
#
# Requires: curl, jq   (macOS: brew install jq)
set -euo pipefail

BASE="https://www.mycourseville.com/"
export TZ=Asia/Bangkok          # MyCourseVille shows times in Bangkok time
SHOW=upcoming                   # upcoming | todo | all
PLAIN=0

usage() { sed -n '2,12p' "$0" | sed 's/^# \{0,1\}//'; exit "${1:-0}"; }
while getopts "tahp" opt; do
  case $opt in
    t) SHOW=todo ;;
    a) SHOW=all ;;
    p) PLAIN=1 ;;
    h) usage 0 ;;
    *) usage 1 ;;
  esac
done
shift $((OPTIND - 1))

command -v jq >/dev/null || { echo "jq is required (brew install jq)" >&2; exit 1; }
if [[ -z "${MCV_COOKIES:-}" ]]; then
  echo "Set MCV_COOKIES to your browser cookie string" >&2; exit 1
fi

# ---------- HTTP ----------
get_page() {   # full HTML page, as the browser would load it
  curl -sS --fail --max-time 20 "$1" -H "Cookie: $MCV_COOKIES"
}
post_ajax() {  # $1 = path after ?q=, $2 = form data
  curl -sS --fail --max-time 20 "${BASE}?q=$1" \
    -H "Cookie: $MCV_COOKIES" \
    -H 'X-Requested-With: XMLHttpRequest' \
    -H 'Accept: application/json' \
    -H 'Content-Type: application/x-www-form-urlencoded; charset=UTF-8' \
    -H "Referer: $BASE" \
    --data "$2"
}
die_login() {
  echo "MyCourseVille sent the login page: your cookie has expired." >&2
  echo "Copy a fresh one from the browser and export MCV_COOKIES again." >&2
  exit 1
}

# ---------- dates (works with GNU date and macOS date) ----------
if date -d @0 >/dev/null 2>&1; then
  to_epoch() { LC_ALL=C date -d "$1" +%s; }                       # "01 November 2026 09:00"
  fmt_epoch() { LC_ALL=C date -d "@$1" '+%a %d %b %H:%M'; }
else
  to_epoch() { LC_ALL=C date -j -f '%d %B %Y %H:%M' "$1" +%s; }
  fmt_epoch() { LC_ALL=C date -r "$1" '+%a %d %b %H:%M'; }
fi
relative() {   # seconds -> "in 2d 11h" / "3d ago"
  local s=$1 sign="in " suffix="" d h m
  if (( s < 0 )); then s=$(( -s )); sign=""; suffix=" ago"; fi
  d=$(( s / 86400 )); h=$(( s % 86400 / 3600 )); m=$(( s % 3600 / 60 ))
  if (( d > 0 )); then echo "${sign}${d}d ${h}h${suffix}"
  elif (( h > 0 )); then echo "${sign}${h}h ${m}m${suffix}"
  else echo "${sign}${m}m${suffix}"; fi
}

# ---------- parsing ----------
NO_DUE=9999999999
# Reads assignment-table HTML on stdin, prints:
# epoch <TAB> course_no <TAB> submitted|todo <TAB> title <TAB> url
parse_rows() {
  local course=$1 row link path title due epoch status
  tr '\r\n' '  ' | awk '{ gsub(/<tr>/, "\n<tr>"); print }' | { grep '^<tr>' || true; } |
  while IFS= read -r row; do
    link=$(grep -oE 'worksheet/[0-9]+/[0-9]+" target="_blank">[^<]*' <<<"$row" | head -1 || true)
    [[ -z $link ]] && continue
    path=${link%%\"*}
    title=${link#*\">}
    title=$(sed -e 's/&amp;/\&/g' -e 's/&quot;/"/g' -e "s/&#039;/'/g" \
                -e 's/&lt;/</g' -e 's/&gt;/>/g' -e 's/^ *//' -e 's/ *$//' <<<"$title")

    due=$(grep -oE 'Due on [0-9]{1,2} [A-Za-z]+ [0-9]{4} at [0-9]{1,2}:[0-9]{2}' <<<"$row" | head -1 || true)
    if [[ -n $due ]]; then
      due=${due#Due on }
      epoch=$(to_epoch "${due/ at / }" 2>/dev/null || echo $NO_DUE)
    else
      epoch=$NO_DUE
    fi

    if grep -q 'Submitted at' <<<"$row"; then status=submitted; else status=todo; fi
    printf '%s\t%s\t%s\t%s\t%s\n' "$epoch" "$course" "$status" "$title" "${BASE}?q=courseville/$path"
  done
}

# ---------- which courses ----------
discover_courses() {
  local home tuples latest
  home=$(get_page "${BASE}?q=courseville")
  grep -q 'courseville-login-button-list' <<<"$home" && die_login
  # Course icons look like: cv_cid="81802" course_no="2110204" year="2026" semester="1"
  tuples=$(grep -oE 'cv_cid="[0-9]+" course_no="[^"]*" year="[0-9]+" semester="[0-9]+"' <<<"$home" \
           | sed -E 's/cv_cid="([0-9]+)" course_no="[^"]*" year="([0-9]+)" semester="([0-9]+)"/\2\3 \1/' \
           | sort -u || true)
  if [[ -n $tuples ]]; then
    latest=$(cut -d' ' -f1 <<<"$tuples" | sort -n | tail -1)   # current semester only
    awk -v t="$latest" '$1 == t { print $2 }' <<<"$tuples"
    return
  fi
  # Fallback: courses that appear in the "due in 7 days" panel
  post_ajax courseville/ajax/getactivepanelcontent "" 2>/dev/null \
    | jq -r '.html // empty' 2>/dev/null \
    | grep -oE 'worksheet/[0-9]+/' | cut -d/ -f2 | sort -u || true
}

if [[ $# -gt 0 ]]; then
  courses=("$@")
else
  courses=()
  while IFS= read -r c; do [[ -n $c ]] && courses+=("$c"); done < <(discover_courses)
  if [[ ${#courses[@]} -eq 0 ]]; then
    echo "Couldn't find your courses automatically." >&2
    echo "Pass course IDs instead, e.g.: $0 81802 89470" >&2
    exit 1
  fi
fi

# ---------- fetch every course ----------
rows=$(mktemp); trap 'rm -f "$rows"' EXIT

for cid in "${courses[@]}"; do
  page=$(get_page "${BASE}?q=courseville/course/${cid}/assignment") \
    || { echo "warning: couldn't load course $cid" >&2; continue; }
  grep -q 'courseville-login-button-list' <<<"$page" && die_login
  if ! grep -q 'id="cv-assignment-table"' <<<"$page"; then
    echo "warning: course $cid has no assignment list" >&2; continue
  fi
  course_no=$(grep -oE 'id="course_info" course_no="[^"]*"' <<<"$page" | head -1 | sed -E 's/.*course_no="([^"]*)"/\1/' || true)
  course_no=${course_no:-$cid}

  parse_rows "$course_no" <<<"$page" >>"$rows"

  # "Load more items": keep asking until the server says everything is shown
  next=""
  if grep -q 'id="courseville-assignment-list-loadmore-panel"' <<<"$page"; then
    next=$(grep -oE 'data-next="[^"]*"' <<<"$page" | head -1 | sed -E 's/data-next="([^"]*)"/\1/' || true)
  fi
  tries=0
  while [[ -n $next && $tries -lt 50 ]]; do
    tries=$((tries + 1))
    resp=$(post_ajax courseville/ajax/loadmoreassignmentrows "cv_cid=${cid}&next=${next}" || true)
    if ! jq -e '.status == 1' >/dev/null 2>&1 <<<"$resp"; then
      echo "warning: couldn't load older assignments for $course_no; showing only the first page" >&2
      break
    fi
    jq -r '.data.html // ""' <<<"$resp" | parse_rows "$course_no" >>"$rows"
    [[ $(jq -r '.all' <<<"$resp") == true ]] && break
    new_next=$(jq -r '.next // empty' <<<"$resp")
    [[ -z $new_next || $new_next == "$next" ]] && break
    next=$new_next
  done
done

# ---------- print ----------
now=$(date +%s)
sort -t $'\t' -k5,5 -u "$rows" | sort -t $'\t' -k1,1n | {
  shown=0
  while IFS=$'\t' read -r epoch course status title url; do
    if [[ $SHOW != all ]]; then
      (( epoch != NO_DUE && epoch < now )) && continue
      [[ $SHOW == todo && $status == submitted ]] && continue
    fi
    if (( PLAIN )); then
      printf '%s\t%s\t%s\t%s\t%s\n' "$epoch" "$course" "$status" "$title" "$url"
      continue
    fi
    if (( epoch == NO_DUE )); then
      when="no due date"
    else
      when="$(fmt_epoch "$epoch")  ($(relative $(( epoch - now ))))"
    fi
    if [[ $status == submitted ]]; then mark="[done]"; else mark="[todo]"; fi
    echo "$when  $mark  $course  $title"
    echo "    $url"
    shown=$((shown + 1))
  done
  if (( shown == 0 && ! PLAIN )); then
    case $SHOW in
      todo) echo "Nothing left to submit. 🎉" ;;
      *)    echo "No upcoming assignments." ;;
    esac
  fi
}
