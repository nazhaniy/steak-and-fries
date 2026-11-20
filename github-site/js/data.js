/* All course content lives here, so it can be edited without touching the app code.

   Text may contain maths between dollar signs, written in LaTeX: $x^2$ or $\frac{1}{x}$.

   Question fields
     kind      expr     = typed answer, checked automatically against `expected`
               mc       = multiple choice (A, B, C or D), `a` is the position of the correct choice, counting from 0.
                This is what "objective" means in quizzes and tests.
               multi    = typed answer the student marks against the solution
               explain  = written explanation the student marks against the solution
     expected  the answer in plain maths, such as 6x^2-2x+6 */

var TOPICS = {
  product: {
    n: 1, tag: 'Differentiation', title: 'Product rule', presenter: 'Muhammad Nazhan',
    blurb: 'Two functions, one derivative. Learn how changing factors work together.',
    formula: "(fg)' = f'g + fg'",
    example: '\\frac{d}{dx}(x^2\\sin x)=2x\\sin x+x^2\\cos x',
    goals: ['Identify when a function is a product.', 'Apply the product rule and simplify.', 'Explain why differentiating each factor alone does not work.'],
    pitfall: 'The derivative of a product is not the product of the derivatives.',
    steps: ['Identify your u and v.', "Find u′ and v′.", 'Put it all together!']
  },
  quotient: {
    n: 2, tag: 'Differentiation', title: 'Quotient rule', presenter: 'Muhammad Nazhan',
    blurb: 'Make sense of fractions of functions, one clear step at a time.',
    formula: "\\left(\\frac{f}{g}\\right)'=\\frac{f'g-fg'}{g^2}",
    example: '\\frac{d}{dx}\\left(\\frac{x}{x+1}\\right)=\\frac{(x+1)-x}{(x+1)^2}=\\frac{1}{(x+1)^2}',
    goals: ['Identify numerator and denominator functions.', 'Apply the quotient rule in the correct order.', 'State restrictions on the original function’s domain.'],
    pitfall: 'Keep the subtraction order consistent, and square the denominator.'
  },
  derivatives: {
    n: 3, tag: 'Foundations', title: 'Essential derivatives', presenter: 'Yi En Erin Lee',
    blurb: 'Build your toolkit for polynomials, trigonometry, and exponentials.',
    formula: '\\frac{d}{dx}x^n=nx^{n-1}',
    example: '\\frac{d}{dx}(3x^4+\\sin x+e^x)=12x^3+\\cos x+e^x',
    goals: ['Differentiate polynomial functions.', 'Use basic sine and cosine derivatives with angles in radians.', 'Recognize derivatives of exponential functions.'],
    pitfall: 'Trigonometric derivative formulas assume that angles are measured in radians.'
  },
  rates: {
    n: 4, tag: 'Applications', title: 'Rates of change', presenter: 'Yi En Erin Lee',
    blurb: 'Connect derivatives to motion, first principles, tangents, and normals.',
    formula: "f'(x)=\\lim_{h\\to0}\\frac{f(x+h)-f(x)}{h}",
    example: "f(x)=x^2,\\quad f'(1)=2,\\quad y-1=2(x-1)",
    goals: ['Interpret average and instantaneous rates of change.', 'Connect first principles to the slope of a tangent.', 'Find tangent and normal equations at a point.'],
    pitfall: 'Use the point on the original curve, not the derivative graph, in your tangent equation.'
  }
};
var TOPIC_ORDER = ['product', 'quotient', 'derivatives', 'rates'];

/* ---------- The four source questions ---------- */
var SOURCE = {
  product: {
    topic: 'product', titleText: 'Product rule demonstration', tex: 'f(x)=(x^2+3)(2x-1)', kind: 'expr', expected: '6x^2-2x+6',
    prompt: 'Differentiate the product. Identify the two factors and show your working.',
    hints: ['Name the two factors before differentiating.', "Use $(fg)'=f'g+fg'$."],
    solution: ["Let $f=x^2+3$ and $g=2x-1$. Then $f'=2x$ and $g'=2$.", 'Apply the product rule: $2x(2x-1)+2(x^2+3)$.', 'Expand and simplify to $6x^2-2x+6$.'],
    testPrompt: 'Differentiate the product. Identify the two factors and show your working. Show each stage, justify your approach, and discuss one common error. Then find the second derivative and determine where the first derivative is increasing. Explain why multiplying the factor derivatives fails.',
    testSolution: ["Second derivative: $f''(x)=12x-2$.", "The first derivative is increasing where $f''(x)>0$, which is $x>\\frac16$.", 'Multiplying the factor derivatives gives $2x\\cdot2=4x$, which is not the derivative. Each factor changes while the other stays in place, so the rule needs both terms.']
  },
  quotient: {
    topic: 'quotient', titleText: 'Quotient rule demonstration', tex: 'f(x)=\\frac{x}{x+1}', kind: 'expr', expected: '1/(x+1)^2',
    prompt: 'Differentiate the quotient and state the restriction on the original function.',
    hints: ['Identify the numerator and denominator.', 'Subtract in the correct order and square the denominator.'],
    solution: ['The original function is defined for $x\\ne-1$.', 'Apply the quotient rule: $\\frac{(x+1)-x}{(x+1)^2}$.', "Simplify to $f'(x)=\\frac{1}{(x+1)^2}$."],
    testPrompt: 'Differentiate the quotient and state the restriction on the original function. Show each stage, justify your approach, and discuss one common error. Treat f as a dimensionless response to input x. Calculate its sensitivity at x = 1, state the domain, and explain why squaring the denominator matters.',
    testSolution: ["Sensitivity at $x=1$: $f'(1)=\\frac14$.", 'The domain is every real number except $x=-1$.', 'The denominator must be squared because that is what the quotient rule produces. Leaving it as $x+1$ gives $\\frac{1}{x+1}$, which is a different function.']
  },
  derivatives: {
    topic: 'derivatives', titleText: 'Derivative toolkit demonstration', tex: 'f(x)=3x^4+\\sin x+e^x', kind: 'expr', expected: '12x^3+cos(x)+e^x',
    prompt: 'Differentiate each term and explain the rules you use. Trigonometric angles are in radians.',
    quizPrompt: 'Explain which differentiation rules apply to this function, including the radians assumption. Then write the derivative.',
    hints: ['Use the power rule for the polynomial term.', 'Differentiate sine and the exponential separately.'],
    solution: ['The power rule gives $\\frac{d}{dx}(3x^4)=12x^3$.', 'In radians, $\\frac{d}{dx}(\\sin x)=\\cos x$ and $\\frac{d}{dx}(e^x)=e^x$.', "Combine the terms: $f'(x)=12x^3+\\cos x+e^x$."],
    testPrompt: 'Differentiate each term and explain the rules you use. Trigonometric angles are in radians. Show each stage, justify your approach, and discuss one common error. Find the second derivative, evaluate it at zero, and analyze the error of differentiating sine as negative cosine.',
    testSolution: ["Second derivative: $f''(x)=36x^2-\\sin x+e^x$.", "At zero: $f''(0)=0-0+1=1$.", 'The derivative of $\\sin x$ is $\\cos x$. Writing $-\\cos x$ flips the sign of the slope, and it would give a slope of $-1$ at $x=0$ where the sine curve is rising with slope $1$.']
  },
  rates: {
    topic: 'rates', titleText: 'Tangent and normal demonstration', tex: 'f(x)=x^2', kind: 'multi',
    prompt: 'For the curve at x = 1, find the instantaneous rate of change, tangent equation, and normal equation. Explain how the two slopes are related.',
    hints: ['Differentiate, then evaluate at x = 1.', 'Both lines pass through (1, 1). The normal slope is the negative reciprocal of the tangent slope.'],
    solution: ["$f'(x)=2x$, so $f'(1)=2$.", 'The point is $(1,1)$. The tangent is $y-1=2(x-1)$.', 'The normal slope is $-\\frac12$, so $y-1=-\\frac12(x-1)$.'],
    testPrompt: 'For the curve at x = 1, find the instantaneous rate of change, tangent equation, and normal equation. Explain how the two slopes are related. Show each stage, justify your approach, and discuss one common error. Also interpret f(t) as displacement in metres with time t in seconds. Derive velocity at t = 1 from first principles and compare it with average velocity from t = 1 to t = 2.',
    testSolution: ['First principles: $\\lim_{h\\to0}\\frac{(1+h)^2-1}{h}=\\lim_{h\\to0}(2+h)=2$, so the velocity at $t=1$ is $2$ m/s.', 'Average velocity from $t=1$ to $t=2$: $\\frac{4-1}{2-1}=3$ m/s.', 'The average is larger because the object keeps speeding up after $t=1$.']
  }
};

var QUOTIENT_CHOICES = ['\\frac{1}{(x+1)^2}', '\\frac{1}{x+1}', '1', '0'];
/* Multiple-choice answers for the other demonstrations. The first one is correct. */
var CHOICES = {
  product: ['6x^2-2x+6', '4x', '2x(2x-1)', '6x^2+2x+6'],
  quotient: QUOTIENT_CHOICES,
  derivatives: ['12x^3+\\cos x+e^x', '12x^3-\\cos x+e^x', '3x^3+\\cos x+e^x', '12x^3+\\cos x+xe^{x-1}']
};

function ask(source, number, overrides) {
  var s = SOURCE[source];
  return Object.assign({
    id: 'demo' + number, topic: s.topic, title: 'Demonstration ' + number + ': ' + s.titleText,
    tex: s.tex, kind: s.kind, expected: s.expected, prompt: s.prompt, hints: s.hints, solution: s.solution
  }, overrides);
}
function quizMc(number, strand) {
  return ask('quotient', number, {
    strand: strand, kind: 'mc', choices: QUOTIENT_CHOICES, a: 0,
    prompt: 'Choose the derivative of the displayed quotient. Include a brief explanation in the working field.'
  });
}
function quizExplain(number, strand) {
  return ask('derivatives', number, { strand: strand, kind: 'explain', prompt: SOURCE.derivatives.quizPrompt });
}
/* Objective question: pick A, B, C or D. */
function mcAsk(source, number, strand) {
  return ask(source, number, { strand: strand, kind: 'mc', choices: CHOICES[source], a: 0, prompt: 'Choose the derivative of the displayed function.' });
}
/* Subjective question: a worked answer the student checks against the solution. */
function testAsk(source, number, strand) {
  var s = SOURCE[source];
  return ask(source, number, { strand: strand, kind: 'multi', prompt: s.testPrompt, solution: s.solution.concat(s.testSolution) });
}

var COURSE = {
  homework: [
    ask('product', 1), ask('quotient', 2), ask('derivatives', 3), ask('rates', 4),
    ask('product', 5), ask('quotient', 6), ask('derivatives', 7)
  ],
  quizzes: {
    quiz1: {
      layout: 'a', part: 'Part 1', instructor: 'Muhammad Nazhan', title: 'Quiz 1: Product & Quotient Rules', minutes: 15,
      covers: ["Product Rule: $(fg)' = f'g + fg'$", "Quotient Rule: $(f/g)' = (f'g - fg') / g^2$", 'Factor identification and domain restrictions'],
      questions: [
        mcAsk('product', 1, 'Knowledge'), quizMc(2, 'Application'),
        ask('product', 5, { strand: 'Thinking', kind: 'multi' }), quizMc(6, 'Communication')
      ]
    },
    quiz2: {
      layout: 'b', part: 'Part 2', instructor: 'Yi En Erin Lee', title: 'Quiz 2: Essential Derivatives & Rates of Change', minutes: 15,
      covers: ['Power rule, $\\sin x$, $\\cos x$ in radians and $e^x$', 'Instantaneous rates of change from first principles', 'Tangent lines and velocity applications'],
      questions: [quizExplain(3, 'Knowledge'), ask('rates', 4, { strand: 'Application' }), quizExplain(7, 'Thinking')]
    }
  },
  tests: {
    test1: {
      layout: 'a', part: 'Part 1', instructor: 'Muhammad Nazhan', title: 'Test 1: Product & Quotient Rules', minutes: 45,
      covers: ["Product Rule: $(fg)' = f'g + fg'$", "Quotient Rule: $(f/g)' = (f'g - fg') / g^2$", 'Factor identification and domain restrictions'],
      questions: [
        mcAsk('product', 1, 'Knowledge'), mcAsk('quotient', 9, 'Knowledge'),
        testAsk('quotient', 2, 'Application'), testAsk('quotient', 10, 'Application'),
        testAsk('product', 5, 'Thinking'), testAsk('quotient', 6, 'Communication')
      ]
    },
    test2: {
      layout: 'b', part: 'Part 2', instructor: 'Yi En Erin Lee', title: 'Test 2: Essential Derivatives & Rates of Change', minutes: 45,
      covers: ['Power rule, $\\sin x$, $\\cos x$ in radians and $e^x$', 'Instantaneous rates of change from first principles', 'Tangent lines and velocity applications'],
      questions: [
        mcAsk('derivatives', 3, 'Knowledge'), mcAsk('derivatives', 11, 'Knowledge'),
        testAsk('rates', 4, 'Application'), testAsk('rates', 12, 'Application'),
        testAsk('derivatives', 7, 'Thinking'), testAsk('rates', 8, 'Communication')
      ]
    }
  }
};

var TEAM = {
  teacher: {
    portrait: 'professor', name: 'Mr. A.Sathia Seelan', role: 'MCV4U Lead Teacher', line: 'Teacher profile details will be added by the project members.', pill: 'Read profile',
    details: [
      ['Educational qualifications', 'B.Sc. in Mathematics'],
      ['Teaching experience', '9 years'],
      ['Subject specialization', 'Grade 12 Calculus & Vectors(MCV4U)'],
      ['Short biography', 'Lead supervising educator for Grade 12 Calculus & Vectors at Sunway CIMP, guiding students through differential calculus foundations and vector geometry.']
    ]
  },
  nazhan: {
    portrait: 'alex', name: 'Muhammad Nazhan', role: 'Student instructor', line: 'Product Rule & Quotient Rule', pill: 'Read biography',
    details: [
      ['Short biography', 'CIMP Grade 12 student leading technical development and interactive systems for CCT Calculus, guiding learners through Product Rule and Quotient Rule differentiation techniques.'],
      ['Assigned calculus topics', 'Product Rule, Quotient Rule']
    ]
  },
  erin: {
    portrait: 'maya', name: 'Yi En Erin Lee', role: 'Student instructor', line: 'Derivatives & Rates of Change', pill: 'Read biography',
    details: [
      ['Short biography', 'CIMP Grade 12 student leading educational content design and problem structuring for CCT Calculus, guiding learners through Essential Derivatives and Rates of Change applications.'],
      ['Assigned calculus topics', 'Derivatives, Rates of Change']
    ]
  }
};

/* The formula sheet. Each item is [name, LaTeX]. */
var FORMULAS = [
  { group: 'Basic rules', items: [
    ['Constant', '\\frac{d}{dx}c=0'],
    ['Power rule', '\\frac{d}{dx}x^n=nx^{n-1}'],
    ['Constant multiple', '\\frac{d}{dx}\\left[cf(x)\\right]=cf\'(x)'],
    ['Sum and difference', '\\frac{d}{dx}\\left[f\\pm g\\right]=f\'\\pm g\'']
  ] },
  { group: 'Combining functions', items: [
    ['Product rule', '(fg)\'=f\'g+fg\''],
    ['Quotient rule', '\\left(\\frac{f}{g}\\right)\'=\\frac{f\'g-fg\'}{g^2}'],
    ['Chain rule', '\\frac{d}{dx}f(g(x))=f\'(g(x))\\,g\'(x)']
  ] },
  { group: 'Trigonometric functions', items: [
    ['Sine', '\\frac{d}{dx}\\sin x=\\cos x'],
    ['Cosine', '\\frac{d}{dx}\\cos x=-\\sin x'],
    ['Tangent', '\\frac{d}{dx}\\tan x=\\sec^2 x']
  ] },
  { group: 'Exponentials and logarithms', items: [
    ['Natural exponential', '\\frac{d}{dx}e^x=e^x'],
    ['Exponential', '\\frac{d}{dx}a^x=a^x\\ln a'],
    ['Natural logarithm', '\\frac{d}{dx}\\ln x=\\frac{1}{x}']
  ] },
  { group: 'Meaning of the derivative', items: [
    ['First principles', 'f\'(x)=\\lim_{h\\to0}\\frac{f(x+h)-f(x)}{h}'],
    ['Tangent line at x = a', 'y=f(a)+f\'(a)(x-a)'],
    ['Motion', 'v(t)=s\'(t),\\quad a(t)=v\'(t)']
  ] }
];


/* Lesson videos. One link per lesson (Google Drive: Anyone with the link, Viewer). Change a link here and rebuild. */
var VIDEO_LINKS = {
  product: 'https://drive.google.com/file/d/1b9in3mRudKWWcFuaPV45pYb-MiiiQLT7/view?usp=drivesdk',
  quotient: 'https://drive.google.com/file/d/1b9in3mRudKWWcFuaPV45pYb-MiiiQLT7/view?usp=drivesdk',
  derivatives: 'https://drive.google.com/file/d/1b9in3mRudKWWcFuaPV45pYb-MiiiQLT7/view?usp=drivesdk',
  rates: 'https://drive.google.com/file/d/1b9in3mRudKWWcFuaPV45pYb-MiiiQLT7/view?usp=drivesdk'
};
