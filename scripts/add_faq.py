#!/usr/bin/env python3
"""
Adds FAQ entries to the 7 exam-prep pages in scripts/pages.json.
Run once from the project folder:   python scripts/add_faq.py
Safe to run again: it replaces the "faq" list of those pages each time.
"""
import json
import os

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PATH = os.path.join(ROOT, "scripts", "pages.json")

FAQ = {
    "exam-prep/sat-graphing-calculator/": [
        {"q": "Is ExamGrapher the calculator used on the Digital SAT?",
         "a": "No. ExamGrapher is an independent practice tool and is not affiliated with the College Board. Check the College Board's official calculator policy for what you can use on test day, and use this page to practise graphing skills."},
        {"q": "How do I practise SAT-style graphing questions here?",
         "a": "Type each equation into its own row, for example 3x + 2 and -x + 6. Where the two lines meet is marked automatically and listed under Key points, so you can check an intersection you worked out by hand."},
        {"q": "What does US Exam Mode do?",
         "a": "It turns off key-point hints and tooltips so you graph without help, which is closer to working with a basic test calculator. Switch it on in Settings."},
        {"q": "Do I need an account or an app?",
         "a": "No. It is free, needs no sign-in, and runs in your phone or computer browser."},
    ],
    "exam-prep/act-graphing-calculator/": [
        {"q": "Is this an approved ACT calculator?",
         "a": "No. ExamGrapher is an independent practice tool and is not affiliated with ACT, Inc. Read ACT's current calculator policy before test day to see which devices are allowed."},
        {"q": "Which kinds of graphs should I practise for ACT Math?",
         "a": "Try lines, parabolas, absolute value, exponentials and sine or cosine waves. For example, enter x^2 - 4 to see the roots and vertex, or sin(x) to see a period."},
        {"q": "How can I check my answer to a system of equations?",
         "a": "Graph both equations. The intersection point is marked and appears under Key points, so you can compare it with your own solution."},
        {"q": "Will it work on my phone during homework?",
         "a": "Yes. The layout is built for phones, and you can use the built-in math keyboard to type powers, roots and fractions."},
    ],
    "exam-prep/deltamath-graphing-calculator/": [
        {"q": "Can I use this inside a DeltaMath assignment?",
         "a": "ExamGrapher is a separate website, so open it in another tab or window. Ask your teacher what tools are allowed for each assignment."},
        {"q": "Is ExamGrapher connected to DeltaMath?",
         "a": "No. ExamGrapher is an independent tool and is not affiliated with DeltaMath."},
        {"q": "How do I graph a function to check my work?",
         "a": "Type it in the equation box, for example 2x + 1 or x^2 - 3x + 2. Use the + and minus buttons or pinch to zoom, and tap a Key point to jump to a root or intercept."},
        {"q": "Can I save or share my graph?",
         "a": "Yes. The share button copies a link that reopens your equations, and Settings lets you download the graph as a PNG image."},
    ],
    "exam-prep/ap-calculus-graphing-calculator/": [
        {"q": "Can I use ExamGrapher on the AP Calculus exam?",
         "a": "No. It is an independent practice tool, not an approved exam device. AP exams have their own calculator rules, and some parts do not allow a calculator at all, so read the College Board's current policy."},
        {"q": "Does it find derivatives and integrals automatically?",
         "a": "Not at the moment. You can graph a function and a derivative you worked out yourself to compare their shapes, for example x^3 - 3x and 3x^2 - 3."},
        {"q": "How can I explore how a parameter changes a graph?",
         "a": "Use any extra letter as a slider. Typing a*x^2 + b*x + c lets you drag a, b and c and watch the curve change."},
        {"q": "Is it free to use?",
         "a": "Yes. It is free, needs no sign-in, and works in any modern browser."},
    ],
    "exam-prep/nc-graphing-calculator/": [
        {"q": "Is this the official calculator for North Carolina tests?",
         "a": "No. ExamGrapher is an independent practice tool and is not affiliated with the North Carolina Department of Public Instruction. Check your school or the state's guidance for the calculators allowed on EOG and EOC tests."},
        {"q": "What can I practise with it?",
         "a": "Common school algebra graphs: linear equations, quadratics, exponentials, systems of equations and inequalities. Enter an equation and the roots, intercepts and intersections are marked for you."},
        {"q": "Can I practise without the hints?",
         "a": "Yes. Turn on US Exam Mode in Settings to lock key-point hints and tooltips."},
        {"q": "Will it work on a school Chromebook or phone?",
         "a": "It runs in a normal web browser with no install. Some schools block certain websites, so it may depend on your network."},
    ],
    "exam-prep/georgia-milestones-calculator/": [
        {"q": "Is ExamGrapher the Georgia Milestones online calculator?",
         "a": "No. ExamGrapher is an independent practice tool and is not affiliated with the Georgia Department of Education. Use your school's guidance for what is allowed on the test."},
        {"q": "How do I practise graphing for Georgia Milestones EOC math?",
         "a": "Enter functions such as x^2 - 5x + 6 or 2^x and look at the roots, intercepts and turning points listed under Key points. Compare them with answers you worked out by hand."},
        {"q": "Can I check a system of inequalities?",
         "a": "Yes. Type inequalities such as y > x + 2 and y < -2x + 5, and the region that satisfies both is shaded."},
        {"q": "Do I need to sign in?",
         "a": "No. It is free and works in your browser on phones, tablets and computers."},
    ],
    "exam-prep/virginia-sol-graphing-calculator/": [
        {"q": "Is this the calculator built into the Virginia SOL test?",
         "a": "No. ExamGrapher is an independent practice tool and is not affiliated with the Virginia Department of Education. Your teacher or school can tell you which calculators are allowed on SOL tests."},
        {"q": "What should I practise for SOL math?",
         "a": "Try linear and quadratic functions, systems of equations, and inequalities. For example, graph y = 2x + 1 and y = x^2 - 3 to see where they cross."},
        {"q": "How do I zoom in on a point?",
         "a": "Pinch or scroll to zoom, or tap a Key point in the list to jump straight to it. The home button resets the view."},
        {"q": "Is it free on a phone?",
         "a": "Yes. It is free, needs no account, and the layout is designed for phones."},
    ],
}

with open(PATH, encoding="utf8") as f:
    data = json.load(f)

done = 0
for page in data["pages"]:
    if page["path"] in FAQ:
        page["faq"] = FAQ[page["path"]]
        done += 1

with open(PATH, "w", encoding="utf8", newline="\n") as f:
    json.dump(data, f, indent=1, ensure_ascii=False)
    f.write("\n")

print("FAQ added to %d pages (expected %d)" % (done, len(FAQ)))
