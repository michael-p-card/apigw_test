import json

def handler(event, context):
    print(event)
    print(context)
    
    for record in event['Records']:
        
        body = json.loads(record['body'])
        print(body)

        message = body.get('Message', "No Message field in POST body")
        print(f"MESSAGE CONSUMER LAMBDA: message = {message}")

    return {
        "statusCode": 200,
        "body": json.dumps(event)
    }