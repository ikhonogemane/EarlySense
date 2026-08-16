import ast

src = open("core/views.py").read()
tree = ast.parse(src)

for n in ast.walk(tree):
    if isinstance(n, ast.FunctionDef) and n.name == "generate_report":
        print(f"Function defined at line {n.lineno}")
    if isinstance(n, ast.Assign):
        for t in n.targets:
            if hasattr(t, "id") and t.id == "generate_report":
                print(f"Reassigned at line {n.lineno}")
