numbers = [2246.6, 2349.3, 2717.7, 2791.2, 3057.5, 4189.1, 3824.4, 3958.5, 3473, 3882.8, 4614.3, 4999.9, 5009.9, 5764.5, 6147.3, 4814.1, 6231.5]
new = []


for num in numbers:
    new.append(num/50)

for num in new:
    print(f"{round(num, 3)},")